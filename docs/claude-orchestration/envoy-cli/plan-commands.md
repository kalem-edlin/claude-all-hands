---
description: Plan lifecycle management commands for initialization, status tracking, prompt operations, findings, gates, and completion workflows.
---

# Plan Commands

## Overview

Plans structure multi-step feature development. Plan commands [ref:.claude/envoy/src/commands/plan/index.ts::d53e5c3] provide lifecycle management: creating plans, writing prompts, tracking status, managing user feedback gates, and completing work. Core orchestration tooling for structured development.

## Key Decisions

- **Directory-based plan storage**: Each plan lives in .plans/<branch>/ with plan.md, prompts/, user_input.md, etc. Filesystem as database enables git tracking, manual inspection, easy debugging.

- **Prompt front-matter for metadata**: YAML front-matter in prompt files contains description, success_criteria, depends_on, status, kind. Structured metadata alongside implementation instructions.

- **Blocking gates for user feedback**: Gate commands write YAML files, block until done:true. User edits file with feedback, sets done flag. Ensures human input integrated at key decision points.

- **Status-based lifecycle**: Prompts progress through draft -> in_progress -> implemented -> tested -> reviewed. Commands enforce valid transitions, reject invalid state changes.

- **Variant support**: Prompts can have variants (A, B, C) for parallel implementation approaches. Variant gate enables user selection of best approach.

- **Findings phase**: Before planning, findings capture research and approaches. Separates discovery from execution planning.

## Patterns

Typical flow: init -> write-finding (research) -> write-approach -> block-findings-gate -> write-plan -> write-prompt (multiple) -> block-plan-gate -> start-prompt -> complete-prompt -> block-testing-gate -> complete

Gate lifecycle: write gate file -> notify user -> watch for done flag -> read feedback -> delete gate file -> proceed with feedback incorporated

Prompt dependencies: depends_on field lists prerequisite prompts. next command respects dependencies, returns implementable prompts only.

## Use Cases

- New feature: init creates plan dir, agent researches, writes findings and approaches
- User reviews findings: findings gate blocks, user provides feedback on approaches
- Plan creation: agent writes plan.md and prompts based on approved approaches
- Implementation: agent gets next prompt via next, implements, marks complete
- Testing gate: user runs tests, provides results, agent proceeds or fixes
- Completion: all prompts reviewed, complete marks plan done
