---
description: Blocking gate mechanism for human-in-the-loop approval at critical workflow transitions, using YAML feedback files that agents poll until marked done.
---

# Gate System

## Overview

Gates are synchronization points where agents pause execution, write a feedback file, and block until human sets `done: true`. This ensures human review of agent proposals before irreversible actions. Gates use file-watching with configurable timeout (default 12 hours).

## Key Decisions

**File-based blocking**: Gates write YAML feedback files to `user_feedback/` directory, then poll via watchForDone until `done: true` appears. This approach works across agent restarts and allows humans to edit files at their own pace using any editor.

**Structured feedback schemas**: Each gate type has a specific schema. Findings gate includes per-approach feedback fields with optional `rejected` flags and `question_answers` arrays. Plan gate includes per-prompt feedback. Testing gate includes pass/fail boolean and logs capture.

**Validation before proceeding**: Gate commands validate feedback completeness before returning. For example, BlockFindingsGateCommand [ref:.claude/envoy/src/commands/plan/gates.ts:BlockFindingsGateCommand:0ebeacb] ensures at least one variant per approach number remains un-rejected - prevents accidental deletion of all implementation options.

**User input accumulation**: All gate feedback appends human thoughts and required changes to `user_input.md`, creating an audit trail of human decisions. This accumulated context feeds into subsequent agent prompts.

## Gate Types

**Findings Gate** [ref:.claude/envoy/src/commands/plan/gates.ts:BlockFindingsGateCommand:0ebeacb]: Reviews specialist approaches before planning. Human can reject variants, provide clarifying answers, request changes. Rejected approaches get deleted. On approval without changes, findings archive.

**Plan Gate** [ref:.claude/envoy/src/commands/plan/gates.ts:BlockPlanGateCommand:0ebeacb]: Reviews plan and prompts before implementation. Human can request plan-level or per-prompt changes. Changes trigger replanning loop rather than archiving findings.

**Testing Gate** [ref:.claude/envoy/src/commands/plan/gates.ts:BlockPromptTestingGateCommand:0ebeacb]: Manual testing checkpoint per prompt. Human marks pass/fail, provides logs and change requests if failed. Creates sibling `.logs` file for pasting console output.

**Variants Gate** [ref:.claude/envoy/src/commands/plan/gates.ts:BlockPromptVariantsGateCommand:0ebeacb]: Selection between A/B variants after both pass testing. Human decides accept/reject/feature-flag per variant. Rejected variants delete corresponding prompt files.

**Logging Gate** [ref:.claude/envoy/src/commands/plan/gates.ts:BlockDebuggingLoggingGateCommand:0ebeacb]: Debug-specific gate for capturing runtime logs before diagnosis. Only applies to prompts with `kind: debug`.

## Use Cases

**Iterative refinement**: If human requests changes at plan gate, agents receive `has_user_required_changes: true` in gate response. This signals need to regenerate plan/prompts incorporating feedback, then re-enter plan gate.

**Clarifying questions**: Specialist approaches can include clarifying questions. Findings gate feedback file has `question_answers` arrays. Human answers questions, agent retrieves answered questions via GetFindingApproachCommand with only answered questions included.

**Testing failure loop**: Failed testing gate returns `passed: false` with `user_required_changes`. Agent implements fix, records new iteration in walkthrough, re-enters testing gate. Iteration counter tracks refinement rounds.
