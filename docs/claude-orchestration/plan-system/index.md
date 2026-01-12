---
description: Plan system architecture providing human-in-the-loop orchestration for multi-agent feature development through staged gates and structured artifacts.
---

# Plan System

## Overview

The plan system enables human-supervised multi-agent development workflows. Each feature branch gets a dedicated plan directory containing structured artifacts that track progress from initial findings through implementation to completion. The system enforces human review at critical decision points via blocking gates.

Core philosophy: agents propose, humans approve. Every significant transition requires explicit human acknowledgment through YAML feedback files that agents block on.

## Key Decisions

**Branch-scoped state**: Plan directories are named after sanitized branch names, stored under `.claude/plans/`. This keeps feature state isolated and enables parallel development across branches without interference.

**Staged workflow**: Plans progress through `draft` -> `in_progress` -> `completed` stages tracked in plan front matter [ref:.claude/envoy/src/lib/plan-io.ts:PlanFrontMatter:fc672da]. Stage transitions happen at gate boundaries, ensuring human awareness of workflow state.

**Artifact separation**: Different concern types get separate directories:
- `findings/` - specialist investigation results and approaches
- `prompts/` - implementation task definitions
- `design/` - UI mockups and design manifest
- `user_feedback/` - gate feedback YAML files

**Dependency graph**: Prompts declare dependencies on other prompts via `depends_on` field [ref:.claude/envoy/src/lib/prompts.ts:PromptFrontMatter:fc672da]. The NextCommand [ref:.claude/envoy/src/commands/plan/lifecycle.ts:NextCommand:0ebeacb] respects this ordering, only returning prompts whose dependencies have merged status.

## Use Cases

**New feature development**: User creates branch, agents investigate codebase and propose approaches in findings. Human reviews via findings gate, approves/modifies approaches. Agents generate implementation plan and prompts. Human reviews via plan gate. Agents implement prompts in dependency order, recording walkthroughs. Human tests via testing gates. Plan completes with PR creation.

**Debugging workflow**: Debug-kind prompts get prioritized in next-prompt selection and use a dedicated logging gate [ref:.claude/envoy/src/commands/plan/gates.ts:BlockDebuggingLoggingGateCommand:0ebeacb] for capturing runtime output. After diagnosis, agents cleanup debug markers via CleanupDebugLogsCommand [ref:.claude/envoy/src/commands/plan/protocols.ts:CleanupDebugLogsCommand:0ebeacb].

**Variant exploration**: Approaches can have A/B/C variants representing alternative implementation strategies. Human selects winning variant at variants gate [ref:.claude/envoy/src/commands/plan/gates.ts:BlockPromptVariantsGateCommand:0ebeacb], rejected variants get pruned from findings.

**Session recovery**: If agent crashes mid-implementation, ReleaseAllPromptsCommand [ref:.claude/envoy/src/commands/plan/lifecycle.ts:ReleaseAllPromptsCommand:0ebeacb] clears stale in_progress flags. CheckCommand [ref:.claude/envoy/src/commands/plan/core.ts:CheckCommand:0ebeacb] returns context-appropriate state for resumption.
