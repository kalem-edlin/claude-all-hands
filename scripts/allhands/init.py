"""Initialize allhands in a target repository."""

import shutil
import subprocess
import sys
from pathlib import Path

from .manifest import Manifest


# Files that get migrated to project-specific locations
MIGRATION_MAP = {
    "CLAUDE.md": "CLAUDE.project.md",
    ".claude/settings.json": ".claude/settings.local.json",
}

# Husky hooks that get migrated to project/ subdirectory
HUSKY_HOOKS = [
    "pre-commit",
    "post-merge",
    "commit-msg",
    "pre-push",
    "pre-rebase",
    "post-checkout",
    "post-rewrite",
]


def migrate_existing_files(target: Path) -> dict:
    """Migrate existing target files to project-specific locations.

    Returns dict of {original: migrated} paths that were moved.
    """
    migrated = {}

    # Migrate standard files
    for orig, dest in MIGRATION_MAP.items():
        orig_path = target / orig
        dest_path = target / dest

        if orig_path.exists() and not dest_path.exists():
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            orig_path.rename(dest_path)
            migrated[orig] = dest
            print(f"  Migrated: {orig} → {dest}")

    # Migrate husky hooks to project/
    husky_dir = target / ".husky"
    project_dir = husky_dir / "project"

    if husky_dir.exists():
        for hook in HUSKY_HOOKS:
            hook_path = husky_dir / hook
            project_hook = project_dir / hook

            # Only migrate if hook exists and isn't already in project/
            if hook_path.exists() and not project_hook.exists():
                # Check if it's a real hook file (not allhands managed)
                content = hook_path.read_text()
                # Skip if it's an allhands hook (sources claude/ or project/)
                if "claude/" in content or "project/" in content:
                    continue

                project_dir.mkdir(parents=True, exist_ok=True)
                hook_path.rename(project_hook)
                migrated[f".husky/{hook}"] = f".husky/project/{hook}"
                print(f"  Migrated: .husky/{hook} → .husky/project/{hook}")

    return migrated


def cmd_init(target: Path, auto_yes: bool = False) -> int:
    """Initialize allhands in target repository.

    Args:
        target: Path to target repository
        auto_yes: Skip confirmation prompts
    """
    target = target.resolve()

    # Find allhands root (where this script lives)
    allhands_root = Path(__file__).parent.parent.parent.resolve()
    manifest = Manifest(allhands_root)

    print(f"Initializing allhands in: {target}")
    print(f"Source: {allhands_root}")

    if not target.exists():
        print(f"Error: Target directory does not exist: {target}", file=sys.stderr)
        return 1

    # Check if target is a git repo
    if not (target / ".git").exists():
        print(f"Warning: Target is not a git repository: {target}", file=sys.stderr)
        if not auto_yes:
            confirm = input("Continue anyway? [y/N]: ").strip().lower()
            if confirm != "y":
                print("Aborted.")
                return 1

    # Step 1: Migrate existing files to project-specific locations
    print("\nMigrating existing files...")
    migrated = migrate_existing_files(target)
    if not migrated:
        print("  No files to migrate")

    # Track migrated destinations to avoid overwriting with templates
    migrated_destinations = set(migrated.values())

    # Step 2: Check for files that will be overwritten (no migration path)
    distributable = manifest.get_distributable_files()
    will_overwrite = []

    for rel_path in distributable:
        str_path = str(rel_path)

        # Skip migrated destinations
        if str_path in migrated_destinations:
            continue

        source_file = allhands_root / rel_path
        target_file = target / rel_path

        if target_file.exists() and source_file.exists():
            if source_file.read_bytes() != target_file.read_bytes():
                will_overwrite.append(str_path)

    # Warn about overwrites
    if will_overwrite:
        print(f"\n{'!'*60}")
        print("WARNING: The following files will be OVERWRITTEN:")
        print("(These files exist in target but have no migration path)")
        print(f"{'!'*60}")
        for f in sorted(will_overwrite):
            print(f"  → {f}")
        print()

        if not auto_yes:
            confirm = input("Continue and overwrite these files? [y/N]: ").strip().lower()
            if confirm != "y":
                print("Aborted. No changes made.")
                return 1

    # Step 3: Copy allhands files
    print("\nCopying allhands files...")
    print(f"Found {len(distributable)} files to distribute")

    copied = 0
    skipped = 0

    for rel_path in sorted(distributable):
        str_path = str(rel_path)

        # Skip if this is a migrated destination (preserve user's content)
        if str_path in migrated_destinations:
            skipped += 1
            continue

        source_file = allhands_root / rel_path
        target_file = target / rel_path

        # Skip if source doesn't exist (pattern matched deleted file)
        if not source_file.exists():
            continue

        # Ensure parent directory exists
        target_file.parent.mkdir(parents=True, exist_ok=True)

        if target_file.exists():
            # Check if files are identical
            if source_file.read_bytes() == target_file.read_bytes():
                skipped += 1
                continue

        # Copy file (overwrite if different) - preserves permissions
        shutil.copy2(source_file, target_file)
        copied += 1

    # Step 3: Create .allhandsignore template
    ignore_file = target / ".allhandsignore"
    if not ignore_file.exists():
        ignore_content = """# AllHands Ignore - Exclude files from sync-back to claude-all-hands
# Uses gitignore-style patterns (globs supported)
#
# ┌─────────────────────────────────────────────────────────────────┐
# │ PROJECT-SPECIFIC (add here - stays in THIS repo only):         │
# │   • Project-specific agents, skills, commands                   │
# │   • Local configurations and settings                           │
# │   • Domain-specific hooks                                       │
# │   • Any file that only makes sense for THIS project             │
# ├─────────────────────────────────────────────────────────────────┤
# │ SYNC BACK (do NOT add here - benefits ALL repos):              │
# │   • Bug fixes to existing framework files                       │
# │   • New reusable patterns/skills discovered during development  │
# │   • Documentation improvements                                  │
# │   • Hook/envoy enhancements                                     │
# └─────────────────────────────────────────────────────────────────┘

# Project-specific files (auto-added)
CLAUDE.project.md
.claude/settings.local.json
.husky/project/**

# Project-specific agents
# .claude/agents/my-project-specialist.md

# Project-specific skills
# .claude/skills/my-domain-skill/**

# Project-specific commands
# .claude/commands/my-project-command.md
"""
        ignore_file.write_text(ignore_content)
        print("Created .allhandsignore template")

    # Step 4: Setup husky
    print("\nSetting up husky...")
    result = subprocess.run(
        ["npx", "husky", "install"],
        cwd=target,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        print("  Husky installed")
    else:
        print("  Husky install skipped (may already be configured)")
        if result.stderr:
            print(f"  Details: {result.stderr.strip()}")

    print(f"\n{'='*60}")
    print(f"Done: {copied} copied, {skipped} unchanged")
    if migrated:
        print(f"Migrated {len(migrated)} existing files to project-specific locations")
    print(f"{'='*60}")

    print("\nNext steps:")
    print("  1. Set ALLHANDS_PATH environment variable to: " + str(allhands_root))
    print("  2. Review CLAUDE.project.md for your project-specific instructions")
    print("  3. Review .husky/project/ for your project-specific hooks")
    print("  4. Add project-specific files to .allhandsignore")
    print("  5. Commit the changes")

    return 0
