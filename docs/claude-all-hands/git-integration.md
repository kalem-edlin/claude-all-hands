---
description: Git and GitHub CLI integration patterns for repository operations, file tracking, and fork-based pull request workflow.
---

# Git Integration

## Overview

CLI shells out to git and gh CLIs rather than using libraries. Provides predictable behavior matching user's local git config, avoids JS git library quirks, enables auth reuse from gh CLI.

## Key Decisions

**Synchronous git execution**: [ref:src/lib/git.ts:git:08260ea] uses spawnSync for all git operations. CLI is inherently sequential - no parallel git calls. 10MB output buffer handles large diffs. Returns success boolean plus stdout/stderr for conditional handling.

**Git-aware file listing**: [ref:src/lib/git.ts:getGitFiles:2822f63] combines ls-files (tracked) and ls-files --others --exclude-standard (untracked but not ignored). Push command uses this to skip gitignored files in consumer repo - consumer's .gitignore respected even when source has different rules.

**gh CLI for GitHub operations**: [ref:src/lib/gh.ts:gh:45a2fe3] same pattern as git wrapper. Prerequisites check gh installed and authenticated before operations requiring GitHub access. User's existing gh auth reused - no separate token management.

**Fork workflow isolation**: Push creates contribution in temp directory, never modifies consumer's working tree beyond reading. Clones fork with --depth=1 (shallow), adds upstream remote, creates branch from upstream/main. Consumer's local changes remain uncommitted if desired.

**Branch naming convention**: Contribution branches use `contrib/{username}/{timestamp}` pattern. Prevents collisions if same user pushes multiple contributions. Username from gh api user call, timestamp ensures uniqueness.

## Patterns

Git operations fail fast with meaningful error messages. Auth failure, network issues, permission problems surface immediately rather than partial completion.

Staged file detection [ref:src/lib/git.ts:git:08260ea] via git diff --cached prevents update from overwriting work-in-progress. User must commit or stash before updating managed files.

GitHub operations sequence: check fork exists, create if needed, wait for fork availability (GitHub needs seconds to provision), clone, modify, push, create PR. Each step verifies success before proceeding.

## Use Cases

**Consumer with complex .gitignore**: Consumer repo ignores *.local.* files. Even if source distributes such files, push respects consumer's gitignore - won't include files consumer explicitly ignores.

**Multiple contributions**: User can push from same consumer repo multiple times. Each push creates new timestamped branch. Multiple PRs can be open simultaneously.

**Network-isolated development**: Without gh auth, push command fails at prerequisite check. Init/update work offline if source package already installed - no network required for pull operations.
