---
description: Bidirectional sync workflow with pull for receiving upstream updates and push for contributing changes back via GitHub fork and PR.
---

# Push/Pull Workflow

## Overview

Two sync directions serve different needs. Pull (init/update): consumer receives latest configs from source. Push: consumer contributes improvements back to source via GitHub PR. Asymmetric by design - pull is direct file copy, push goes through PR review.

## Key Decisions

**Init creates fresh installation**: [ref:src/commands/init.ts:cmdInit:851c91c] copies all distributable files to target. CLAUDE.md migration - if target has CLAUDE.md without CLAUDE.project.md, renames to preserve user instructions. Project-specific files (CLAUDE.project.md, .claude/settings.local.json) never overwritten after creation.

**Update preserves customizations**: [ref:src/commands/update.ts:cmdUpdate:851c91c] checks for staged changes to managed files first - refuses update if user has uncommitted work in conflict zones. Detects files deleted from source, offers to delete from target. Same project-specific protection as init.

**Push filters through blocklist**: [ref:src/lib/constants.ts::8d141d3] defines files never pushed back - CLAUDE.project.md (consumer-specific instructions), sync config file. Prevents consumer customizations leaking into source.

**Sync config for push customization**: [ref:src/commands/pull-manifest.ts:cmdPullManifest:5b0e9ca] generates .allhands-sync-config.json template. Consumers can add includes (extra files to push) and excludes (skip certain changes). Merged with CLI flags; CLI flags take precedence when provided.

**Modified vs added distinction**: [ref:src/commands/push.ts:collectFilesToPush:2822f63] marks files as M (modified existing upstream file) or A (added via includes pattern). PR shows clear provenance - reviewer sees which changes modify existing patterns vs introduce new files.

**Fork-based contribution**: [ref:src/commands/push.ts:createPullRequest:5b0e9ca] creates/uses GitHub fork, clones to temp directory, copies files, pushes branch, creates PR. Never modifies consumer's local repo beyond reading files. Temp directory cleanup on exit.

## Patterns

Pull flow preserves intent: identical files skip silently, conflicts require explicit resolution, project-specific files immune to overwrite. Users never lose work without consent.

Push flow is additive only: collects changed/new files from consumer, creates PR to source. No mechanism to delete files from source via push - deletion requires direct source repo access.

Sync config persists in consumer repo (committed), survives updates. Push command merges: config provides defaults, CLI flags override for one-time customization.

## Use Cases

**Receiving upstream improvements**: Run update command. Changes to agent prompts, new agents, bug fixes flow to consumer. Review diff, commit.

**Contributing agent improvement**: Improve agent prompt locally, test in project, run push. PR opens against source repo. Maintainer reviews, merges. All consumers get improvement on next update.

**Excluding experimental changes**: Add pattern to sync config excludes. Local experiments don't accidentally get pushed. Remove from excludes when ready to contribute.

**Including project-adjacent tooling**: Add pattern to sync config includes. Push can propose new scripts, hooks that originated in consumer repo. Source maintainer decides if general-purpose enough.
