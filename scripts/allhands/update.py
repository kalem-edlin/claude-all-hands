"""Update target repo from allhands source."""

import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Set

from .manifest import Manifest


def get_staged_files(repo_path: Path) -> Set[str]:
    """Get list of staged files in repo."""
    result = subprocess.run(
        ["git", "diff", "--cached", "--name-only"],
        cwd=repo_path,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        return set()
    return set(result.stdout.strip().split("\n")) if result.stdout.strip() else set()


def get_allhands_root() -> Path:
    """Get allhands root from environment or relative path."""
    env_path = os.environ.get("ALLHANDS_PATH")
    if env_path:
        return Path(env_path).resolve()

    # Fallback: assume we're running from allhands/scripts
    return Path(__file__).parent.parent.parent.resolve()


def cmd_update(auto_yes: bool = False) -> int:
    """Update target repo from allhands source.

    Copies all distributable files from allhands, overwriting target versions.
    Project-specific files (CLAUDE.project.md, .husky/project/, settings.local.json)
    are preserved since they're not in the distribute list.

    Must be run from within target repo.
    """
    target_root = Path.cwd().resolve()

    # Check we're in a git repo
    if not (target_root / ".git").exists():
        print("Error: Not in a git repository", file=sys.stderr)
        return 1

    allhands_root = get_allhands_root()

    if not (allhands_root / ".allhands-manifest.json").exists():
        print(f"Error: Manifest not found at {allhands_root}", file=sys.stderr)
        print("Set ALLHANDS_PATH to your claude-all-hands directory", file=sys.stderr)
        return 1

    manifest = Manifest(allhands_root)

    print(f"Updating from: {allhands_root}")
    print(f"Target: {target_root}")

    # Check for staged changes to managed files
    staged = get_staged_files(target_root)
    distributable = manifest.get_distributable_files()
    managed_paths = {str(p) for p in distributable}

    conflicts = staged & managed_paths
    if conflicts:
        print("Error: Staged changes detected in managed files:", file=sys.stderr)
        for f in sorted(conflicts):
            print(f"  - {f}", file=sys.stderr)
        print("\nRun 'git stash' or commit first.", file=sys.stderr)
        return 1

    print(f"Found {len(distributable)} distributable files")

    # Check which files will be overwritten
    will_overwrite = []
    deleted_in_source = []

    for rel_path in distributable:
        source_file = allhands_root / rel_path
        target_file = target_root / rel_path

        if not source_file.exists():
            if target_file.exists():
                deleted_in_source.append(rel_path)
            continue

        if target_file.exists():
            if source_file.read_bytes() != target_file.read_bytes():
                will_overwrite.append(str(rel_path))

    # Warn about overwrites
    if will_overwrite:
        print(f"\n{'!'*60}")
        print("WARNING: The following files will be OVERWRITTEN:")
        print(f"{'!'*60}")
        for f in sorted(will_overwrite):
            print(f"  → {f}")
        print()

        if not auto_yes:
            confirm = input("Continue and overwrite these files? [y/N]: ").strip().lower()
            if confirm != "y":
                print("Aborted. No changes made.")
                return 1

    # Copy updated files
    updated = 0
    created = 0

    for rel_path in sorted(distributable):
        source_file = allhands_root / rel_path
        target_file = target_root / rel_path

        if not source_file.exists():
            continue

        target_file.parent.mkdir(parents=True, exist_ok=True)

        if target_file.exists():
            if source_file.read_bytes() != target_file.read_bytes():
                shutil.copy2(source_file, target_file)
                updated += 1
        else:
            shutil.copy2(source_file, target_file)
            created += 1

    # Handle deleted files
    if deleted_in_source:
        print(f"\n{len(deleted_in_source)} files removed from allhands source:")
        for f in deleted_in_source:
            print(f"  - {f}")
        if auto_yes or input("Delete these from target? [y/N]: ").strip().lower() == "y":
            for f in deleted_in_source:
                target_file = target_root / f
                if target_file.exists():
                    target_file.unlink()
                    print(f"  Deleted: {f}")

    print(f"\nUpdated: {updated}, Created: {created}")
    print("\nUpdate complete!")
    print("\nNote: Project-specific files preserved:")
    print("  - CLAUDE.project.md")
    print("  - .claude/settings.local.json")
    print("  - .husky/project/*")

    return 0
