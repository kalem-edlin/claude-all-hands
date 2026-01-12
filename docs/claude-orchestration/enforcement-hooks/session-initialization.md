---
description: Session startup hook - environment initialization, cleanup, plan detection, docs sync.
---

# Session Initialization

## Overview

The startup hook [ref:.claude/hooks/startup.sh::e303012] runs at SessionStart, preparing the environment for agent operation. It handles envoy initialization, artifact validation, stale state cleanup, and branch-aware plan detection. This ensures consistent starting state regardless of how previous sessions ended.

## Key Decisions

- **Envoy lazy initialization**: Startup runs `envoy info` to trigger venv creation if needed. Envoy is self-bootstrapping - first invocation creates its virtual environment. This avoids separate setup step; just start using Claude Code and envoy is ready.

- **Stale state cleanup**: Previous sessions may have left in_progress prompts or orphaned worktrees. Startup runs `envoy plan release-all-prompts` and `envoy git cleanup-worktrees`. Fresh session, clean state.

- **Plan directory auto-creation**: For feature branches, startup runs `envoy plan init`. This ensures plan directory exists before any plan-related operations. Idempotent - safe to run even if already initialized.

- **Branch-aware behavior**: Startup detects branch type. Base branches (main, master, develop, etc.) and special prefixes (quick/, curator/, docs/) skip plan initialization - they're direct work without planning. Feature branches get plan infrastructure.

## Patterns

**Background sync for docs**: Claude-code-docs repo synced in background (`&` suffix). Clone if missing, pull if behind. Non-blocking - doesn't delay session start. Keeps reference documentation current without user action.

**Silent operation**: Most startup operations redirect stderr to /dev/null. User sees clean output, not infrastructure noise. Errors handled gracefully - missing envoy or failed cleanup doesn't break session.

**Main agent identification**: Startup outputs "You are the Main Agent - Main Agent Rules apply to you". This establishes context for the session - main agent orchestrates, delegates to specialists.

## Use Cases

- **Fresh clone, first session**: User clones repo, starts Claude Code. Startup fires → envoy info triggers venv creation → artifact validation runs → claude-code-docs clones in background → session ready with full tooling.

- **Feature branch work resumption**: User returns to feature branch after interruption. Startup fires → release-all-prompts clears stale in_progress states → plan init ensures directory exists → plan check determines current stage → ready to continue.

- **Base branch direct work**: User on main branch for quick fix. Startup fires → detects base branch → skips plan initialization → "Main Agent" message output → ready for direct work without planning overhead.
