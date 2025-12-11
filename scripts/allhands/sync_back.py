"""Sync changes back to allhands as PR."""

import os
import subprocess
import sys
from pathlib import Path
from typing import List

from .manifest import Manifest, is_ignored, load_ignore_patterns


# Protected branches trigger auto sync-back via post-merge hook
# All branches can use manual sync-back
PROTECTED_BRANCHES = {"main", "master", "develop", "staging", "production"}


def get_current_branch(repo_path: Path) -> str:
    """Get current git branch name."""
    result = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        cwd=repo_path,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip() if result.returncode == 0 else ""


def get_repo_name(repo_path: Path) -> str:
    """Get repository name from git remote or directory."""
    result = subprocess.run(
        ["git", "remote", "get-url", "origin"],
        cwd=repo_path,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        url = result.stdout.strip()
        # Extract repo name from URL
        name = url.rstrip("/").split("/")[-1]
        if name.endswith(".git"):
            name = name[:-4]
        return name
    return repo_path.name


def get_changed_managed_files(
    target_root: Path,
    allhands_root: Path,
    manifest: Manifest,
    ignore_patterns: List[str],
) -> List[Path]:
    """Get managed files that differ from source (sync-back candidates)."""
    changes = []

    for rel_path in manifest.get_distributable_files():
        str_path = str(rel_path)

        # Skip ignored files
        if is_ignored(str_path, ignore_patterns):
            continue

        source_file = allhands_root / rel_path
        target_file = target_root / rel_path

        if not target_file.exists():
            continue

        if not source_file.exists():
            # New file in target - sync-back candidate
            changes.append(rel_path)
            continue

        if source_file.read_bytes() != target_file.read_bytes():
            changes.append(rel_path)

    return changes


def get_new_files_in_managed_dirs(
    target_root: Path,
    allhands_root: Path,
    manifest: Manifest,
    ignore_patterns: List[str],
) -> List[Path]:
    """Find new files in target that don't exist in source but match distribute patterns."""
    new_files = []

    # Check .claude/ directory for new files
    claude_dir = target_root / ".claude"
    if claude_dir.exists():
        for target_file in claude_dir.rglob("*"):
            if not target_file.is_file():
                continue

            rel_path = target_file.relative_to(target_root)
            str_path = str(rel_path)

            # Skip ignored
            if is_ignored(str_path, ignore_patterns):
                continue

            # Check if it's a new file (not in source)
            source_file = allhands_root / rel_path
            if not source_file.exists() and manifest.is_distributable(str_path):
                new_files.append(rel_path)

    return new_files


def create_or_update_pr(
    allhands_root: Path,
    target_root: Path,
    files_to_sync: List[Path],
    branch_name: str,
) -> bool:
    """Create or update PR in allhands repo with synced changes."""
    repo_name = get_repo_name(target_root)
    pr_branch = f"{repo_name}/{branch_name}"

    # Check if branch exists
    result = subprocess.run(
        ["git", "rev-parse", "--verify", pr_branch],
        cwd=allhands_root,
        capture_output=True,
    )
    branch_exists = result.returncode == 0

    if not branch_exists:
        # Create new branch from main
        subprocess.run(
            ["git", "checkout", "-b", pr_branch, "main"],
            cwd=allhands_root,
            capture_output=True,
        )
    else:
        subprocess.run(
            ["git", "checkout", pr_branch],
            cwd=allhands_root,
            capture_output=True,
        )

    # Copy files from target to allhands
    for rel_path in files_to_sync:
        source = target_root / rel_path
        dest = allhands_root / rel_path

        if source.exists():
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(source.read_bytes())
        elif dest.exists():
            dest.unlink()

    # Stage and commit
    subprocess.run(
        ["git", "add", "-A"],
        cwd=allhands_root,
        capture_output=True,
    )

    result = subprocess.run(
        ["git", "diff", "--cached", "--quiet"],
        cwd=allhands_root,
    )
    if result.returncode == 0:
        subprocess.run(["git", "checkout", "main"], cwd=allhands_root, capture_output=True)
        return True

    commit_msg = f"sync: {repo_name}/{branch_name}"
    subprocess.run(
        ["git", "commit", "-m", commit_msg],
        cwd=allhands_root,
        capture_output=True,
    )

    # Push branch
    result = subprocess.run(
        ["git", "push", "-u", "origin", pr_branch],
        cwd=allhands_root,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"Warning: Push failed: {result.stderr}", file=sys.stderr)

    # Create PR via gh CLI
    result = subprocess.run(
        ["gh", "pr", "view", pr_branch],
        cwd=allhands_root,
        capture_output=True,
    )
    pr_exists = result.returncode == 0

    if not pr_exists:
        result = subprocess.run(
            [
                "gh", "pr", "create",
                "--title", f"Sync from {repo_name}/{branch_name}",
                "--body", f"Automated sync-back from target repository.\n\nBranch: `{branch_name}`\nFiles: {len(files_to_sync)}",
                "--base", "main",
            ],
            cwd=allhands_root,
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            print(f"PR: {result.stdout.strip()}")
        else:
            print(f"PR creation failed: {result.stderr}", file=sys.stderr)
    else:
        print(f"PR updated: {pr_branch}")

    # Return to main
    subprocess.run(["git", "checkout", "main"], cwd=allhands_root, capture_output=True)

    return True


def cmd_sync_back(auto: bool = False) -> int:
    """Sync changes back to allhands as PR.

    Any branch can sync back - each creates its own PR: [repo]/[branch]
    Auto mode (hook) triggers on protected branch merges.
    Manual mode works on any branch.

    Args:
        auto: Non-interactive mode (for hooks) - silent on errors
    """
    target_root = Path.cwd().resolve()

    # Check we're in a git repo
    if not (target_root / ".git").exists():
        print("Error: Not in a git repository", file=sys.stderr)
        return 1

    current_branch = get_current_branch(target_root)

    # Validate branch name
    if not current_branch:
        if auto:
            return 0  # Silent exit - no branch (detached HEAD or new repo)
        print("Error: Could not determine current branch", file=sys.stderr)
        print("Ensure you have at least one commit and are on a branch", file=sys.stderr)
        return 1

    # In auto mode (hook), only run on protected branches
    # Manual mode (no --auto flag) works on ANY branch
    if auto and current_branch not in PROTECTED_BRANCHES:
        # Silent exit - hook only triggers on protected branches
        return 0

    allhands_root_env = os.environ.get("ALLHANDS_PATH")
    if not allhands_root_env:
        if auto:
            print("ALLHANDS_PATH not set - skipping sync-back", file=sys.stderr)
            return 0
        print("Error: ALLHANDS_PATH environment variable not set", file=sys.stderr)
        return 1

    allhands_root = Path(allhands_root_env).resolve()

    if not (allhands_root / ".allhands-manifest.json").exists():
        print(f"Error: Manifest not found at {allhands_root}", file=sys.stderr)
        return 1

    manifest = Manifest(allhands_root)
    ignore_patterns = load_ignore_patterns(target_root)

    # Find changed files (all non-ignored differences sync back)
    changed_files = get_changed_managed_files(
        target_root, allhands_root, manifest, ignore_patterns
    )

    # Find new files in managed dirs
    new_files = get_new_files_in_managed_dirs(
        target_root, allhands_root, manifest, ignore_patterns
    )

    files_to_sync = changed_files + new_files

    if not files_to_sync:
        print("No changes to sync back")
        return 0

    repo_name = get_repo_name(target_root)
    pr_branch = f"{repo_name}/{current_branch}"

    print(f"\nSyncing {len(files_to_sync)} file(s) back to claude-all-hands...")
    print(f"PR branch: {pr_branch}")
    print(f"Files:")
    for f in files_to_sync:
        print(f"  → {f}")
    print(f"\nTo exclude files, add patterns to .allhandsignore")

    # Create PR (no confirmation needed)
    try:
        success = create_or_update_pr(
            allhands_root, target_root, files_to_sync, current_branch
        )
        return 0 if success else 1
    except Exception as e:
        print(f"Error: Sync-back failed: {e}", file=sys.stderr)
        return 1 if not auto else 0  # Don't fail hooks
