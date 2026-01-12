---
description: Recovery mechanisms for crashed sessions, stale dependencies, and orphaned plan directories - enabling graceful workflow resumption.
---

# Healing and Recovery

## Overview

The plan system handles failure scenarios through explicit recovery commands. Sessions can crash mid-implementation, dependencies can become stale when prompts are modified, and plan directories can accumulate for deleted branches. Each scenario has a targeted healing mechanism.

## Key Decisions

**Prompt lock release**: In-progress prompts block other workers from claiming them. ReleaseAllPromptsCommand [ref:.claude/envoy/src/commands/plan/lifecycle.ts:ReleaseAllPromptsCommand:0ebeacb] clears all `in_progress` flags for the plan, allowing work to resume after crash. Does not reset status - implementation progress preserved.

**Dependency staleness detection**: ValidateDependenciesCommand [ref:.claude/envoy/src/commands/plan/prompts.ts:ValidateDependenciesCommand:0ebeacb] compares `planned_at` timestamps. If a dependency prompt was modified after its dependent was planned, dependent is marked stale. This catches assumptions that may no longer hold.

**Staleness resolution**: UpdatePromptDependenciesCommand bumps `planned_at` to current time while updating dependencies. This acknowledges the stale state and signals that dependent prompt was reviewed against updated dependency.

**Orphan cleanup**: CleanupOrphanedCommand lists local git branches, compares against plan directory names, removes plan directories without matching branches. Prevents accumulation of stale plan state.

**Context-aware resumption**: CheckCommand [ref:.claude/envoy/src/commands/plan/core.ts:CheckCommand:0ebeacb] returns different context based on plan stage. Draft stage returns user_input. In_progress returns plan content and prompt statuses. Completed returns summary. Agents can resume from appropriate point without reconstructing history.

## Patterns

**Crash recovery flow**: On session restart, main agent calls `plan check` to assess state. If prompts show `in_progress` but no active workers, calls `release-all-prompts`. Then resumes normal `next` -> `start-prompt` cycle.

**Dependency invalidation**: If upstream prompt requires changes after plan gate, its `planned_at` updates. Downstream prompts now have stale dependencies. Before implementing downstream, agent calls `validate-dependencies`, sees staleness, either updates dependency list or regenerates dependent prompt with new assumptions.

**Debug log cleanup**: After debugging session, temporary logging statements remain in codebase. CleanupDebugLogsCommand [ref:.claude/envoy/src/commands/plan/protocols.ts:CleanupDebugLogsCommand:0ebeacb] removes `[DEBUG-TEMP]` markers and their associated log lines. Prevents debug artifacts from persisting to merge.

## Use Cases

**Interrupted implementation**: Worker implements prompt, crashes before testing gate. On restart, CheckCommand shows plan in_progress with implemented prompt. Release clears lock. Worker re-claims prompt, continues from testing gate rather than re-implementing.

**Replanning after feedback**: User requests significant changes at plan gate. Planner regenerates prompts with updated `planned_at`. Old prompts referencing original plan now show as stale. Orchestrator detects staleness, triggers full replan cycle.

**Repository maintenance**: After feature branches merge and delete, their plan directories remain. Periodic cleanup-orphaned call garbage collects obsolete plan state.
