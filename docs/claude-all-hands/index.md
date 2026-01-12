---
description: NPM CLI for one-way distribution of agent configurations from source to consumer repositories, with conflict handling and project-specific file preservation.
---

# Claude All-Hands

## Overview

Claude All-Hands solves the challenge of sharing Claude agent configurations across multiple repositories. The fundamental problem: how do you distribute a shared framework of agents, skills, hooks, and commands to multiple projects while preserving project-specific customizations?

The solution uses NPM distribution combined with file copying. Rather than using git submodules which create tight coupling and merge complexity, All-Hands treats the NPM package as a distribution vehicle for configuration files that get copied directly into consumer repos. The sync model is intentionally one-way: source to consumer only. This simplification eliminates the complexity of bidirectional sync, conflict merging, and tracking which consumer changes should flow back upstream.

## Key Decisions

### One-Way Sync Model

The framework deliberately avoids bidirectional synchronization. Earlier iterations explored sync-back functionality to pull consumer improvements upstream, but this created significant complexity: tracking ignored files, resolving merge conflicts across repos, and determining which consumer customizations were intentional vs. accidental divergence. The current design treats the source repo as the single source of truth. Consumer repos receive updates; they don't contribute changes back automatically. Teams wanting to contribute improvements do so through the normal PR process against the source repo.

### File Distribution Over Git Submodules

Git submodules were rejected because they create friction and merge complexity. The All-Hands approach copies files directly into consumer repos, making them first-class citizens. The trade-off is that updates require explicit sync commands rather than automatic submodule updates.

### Manifest-Based Distribution Control

The manifest system [ref:.allhands-manifest.json::d53e5c3] defines three file categories: distributable files that get copied to consumer repos, internal files that stay in the source package, and excluded files like caches and local settings. This separation ensures consumers receive exactly what they need without package internals cluttering their repos.

The [ref:src/lib/manifest.ts:Manifest:f721ebe] class implements pattern matching using minimatch globs, enabling flexible rules like distributing all agents while excluding Python bytecode.

### Project-Specific File Preservation

When initializing or updating a repo, the system handles CLAUDE.md specially:
- If user has CLAUDE.md but no CLAUDE.project.md, their file migrates to CLAUDE.project.md, then framework CLAUDE.md is distributed
- If user has both and CLAUDE.md differs, treated as a conflict
- If user has neither, distributes both files

Project-specific files like CLAUDE.project.md and .claude/settings.local.json are excluded from distribution and preserved during updates. This boundary is strict: the framework owns CLAUDE.md, the consumer owns CLAUDE.project.md.

### Conflict Handling with User Choice

When distributable files conflict with existing target files (content differs), the CLI presents three options via [ref:src/lib/ui.ts:askConflictResolution:7baefe1]: backup (create file.backup_N.ext and overwrite), overwrite (replace all conflicting files), or cancel (abort with no changes). This ensures users never lose work unexpectedly while still enabling updates.

## Patterns

### Staged Change Protection

The update command uses [ref:src/lib/git.ts:getStagedFiles:08260ea] to detect staged changes to managed files before making modifications. If any managed file has staged changes, the command aborts with guidance to stash or commit first. This prevents accidental loss of work-in-progress modifications and ensures users maintain a clean working state before pulling updates.

### Source Resolution Priority

The [ref:src/lib/paths.ts:getAllhandsRoot:08260ea] function implements a resolution chain for finding the source files: first checking ALLHANDS_PATH environment variable for development workflows, then falling back to the installed package location for production use. This supports both npx execution and local development without configuration changes.

### Gitignore Synchronization

Framework files often need gitignore entries in consumer repos. Rather than requiring manual maintenance, [ref:src/commands/init.ts:syncGitignore:42312c4] merges source gitignore entries into the target, adding only what is missing. This ensures framework files like local settings stay untracked across all consumer repos.

### Deleted File Handling

When files are removed from the source distribution, [ref:src/commands/update.ts:cmdUpdate:d53e5c3] detects their absence and prompts users to delete them from the target. This keeps consumer repos clean and prevents accumulation of obsolete framework files.

## Technologies

The CLI uses yargs for command parsing, minimatch for glob pattern matching. It bundles to a single executable via esbuild targeting Node 18+, enabling npx execution without manual installation. The entry point [ref:src/cli.ts::d53e5c3] registers two commands: init and update.

## Use Cases

### Initial Framework Adoption

A team starting a new project runs init via [ref:src/commands/init.ts:cmdInit:d53e5c3] to copy the shared agent configurations into their repo. Existing CLAUDE.md migrates to CLAUDE.project.md, and they immediately have access to all shared agents, skills, and commands while retaining their customizations. The envoy shell function is also configured for easy command invocation.

### Keeping Consumer Repos Current

When the source framework receives improvements, maintainers of consumer repos run update. The command detects conflicts, offers backup/overwrite/cancel options, and preserves project-specific files. Files removed from source are flagged for deletion in the target.

### Contributing Improvements Back

Since sync is one-way, teams wanting to contribute improvements create PRs against the source repository directly. This follows standard open-source contribution patterns rather than automatic sync-back, making the contribution process explicit and reviewable.
