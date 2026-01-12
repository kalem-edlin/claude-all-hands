---
description: Prompt execution lifecycle from selection through implementation, testing, and merge - including parallel dispatch, iteration tracking, and completion workflows.
---

# Prompt Lifecycle

## Overview

Prompts progress through a defined lifecycle: selection via dependency-aware queuing, implementation with walkthrough capture, optional review cycles, manual testing gates, and finally merge status. The system supports parallel execution of independent prompts while respecting dependency ordering.

## Key Decisions

**Dependency-aware selection**: NextCommand [ref:.claude/envoy/src/commands/plan/lifecycle.ts:NextCommand:0ebeacb] returns prompts whose dependencies have all reached `merged` status. This ensures implementation proceeds in correct order - no prompt starts before its prerequisites complete.

**Parallel worker support**: NextCommand accepts count parameter (via `-n` flag or `N_PARALLEL_WORKERS` env). Returns up to N independent prompts that can execute simultaneously in separate worktrees. When selecting a numbered prompt, all its variants come along.

**Debug priority**: Debug-kind prompts sort before feature prompts in next-prompt selection. Bugs get fixed before features proceed, preventing wasted effort on broken foundations.

**In-progress locking**: StartPromptCommand [ref:.claude/envoy/src/commands/plan/lifecycle.ts:StartPromptCommand:0ebeacb] sets `in_progress: true` flag, preventing same prompt from being returned by NextCommand to another worker. Tracks which specialist/worktree owns the prompt.

**Iteration tracking**: Each implementation attempt records iteration number. RecordImplementationCommand [ref:.claude/envoy/src/commands/plan/lifecycle.ts:RecordImplementationCommand:0ebeacb] appends walkthrough entries with iteration count and refinement reason. Enables distinguishing initial implementation from review/testing refinements.

**Status progression**: Prompts move through `unimplemented` -> `implemented` (walkthrough recorded) -> `reviewed` (optional) -> `tested` (testing gate passed) -> `merged` (prompt completed). Status stored in front matter, queryable via plan check.

## Patterns

**Worker claim cycle**: Worker calls `next` to get prompt, calls `start-prompt` to claim it, implements changes, calls `record-implementation` with walkthrough, enters appropriate gate. On gate pass, calls `complete-prompt` to set merged status.

**Testing failure retry**: If testing gate fails, prompt remains at `implemented` status. Worker receives failure feedback, implements fix, records new iteration walkthrough with `type: testing-refinement`, re-enters testing gate.

**Session recovery**: If worker crashes, prompt stays `in_progress: true`. ReleaseAllPromptsCommand [ref:.claude/envoy/src/commands/plan/lifecycle.ts:ReleaseAllPromptsCommand:0ebeacb] clears all in_progress flags, allowing prompts to be re-claimed. Walkthrough history preserved for context.

## Use Cases

**Single-worker flow**: Main agent gets next prompt, implements it, tests it, marks complete, gets next prompt. Sequential processing with human testing checkpoints.

**Multi-worker parallel**: Orchestrator spawns N background workers in separate worktrees. Each worker claims independent prompts from queue. Workers merge their worktree branches as prompts complete. Main branch accumulates merged changes.

**Plan completion**: When all prompts reach merged status, CompleteCommand [ref:.claude/envoy/src/commands/plan/lifecycle.ts:CompleteCommand:0ebeacb] generates PR summary using Gemini, writes summary to plan directory, pushes branch, creates GitHub PR. Plan stage updates to `completed`.

**Documentation extraction**: Post-completion, GetAllWalkthroughsCommand retrieves undocumented prompt walkthroughs. Documentation agent processes walkthroughs, extracts knowledge, marks prompts as `documentation_extracted: true`.
