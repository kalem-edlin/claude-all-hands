---
description: >-
  Envoy CLI plan system managing planning workflow state through gates,
  findings, protocols, and prompts for human-in-the-loop orchestration of
  multi-agent development with desktop notification integration for gate
  visibility.
---

# Plan System

## Overview

The plan system is the state machine that orchestrates multi-agent development workflows. Its core purpose is ensuring humans remain in control of key decisions while agents handle routine work. The system achieves this through blocking gates that pause execution until users review, approve, or provide feedback via YAML files that agents cannot modify without user intervention.

Plans are branch-scoped. Each git feature branch gets its own plan directory with findings from discovery, prompts for implementation, and user input logs. This isolation means multiple features can be developed in parallel without plans interfering with each other. When a branch merges, its plan state persists as documentation of how the feature was built.

A critical aspect of the gate mechanism is visibility. When gates block, the notification system alerts users with desktop notifications showing which repo and branch needs attention. This ensures humans are notified immediately rather than discovering blocked workflows hours later when checking back on agent progress.

## Key Decisions

**Three-stage lifecycle for progressive commitment**: Plans move through draft, in_progress, and completed stages [ref:.claude/envoy/src/lib/plan-io.ts:PlanFrontMatter:fc672da]. Draft means discovery is happening but no implementation commitment. In_progress means prompts exist and implementation can begin. Completed means all prompts merged and PR created. This staging prevents premature implementation while discovery is still surfacing options.

**Blocking gates for human decision points**: Gates [ref:.claude/envoy/src/lib/gates.ts::783a982] create YAML feedback files and poll until the user sets done: true. The gate mechanism exists because certain decisions fundamentally require human judgment - which approach to pursue, whether test results are acceptable, which variant becomes the main solution. Agents write gate files with structured fields, users edit them, agents read the response. This file-based handoff is intentional: it creates an audit trail and prevents agents from accidentally proceeding without approval.

**Gate notifications for immediate visibility**: Every gate write operation triggers a desktop notification via [ref:.claude/envoy/src/lib/notification.ts:sendGateNotification:f3a3dfc]. The notification includes the gate type (Findings, Plan, Testing, Variants, Logging, Audit, Review) and contextual message, while the notification subtitle auto-populates with repo name and branch. This design choice acknowledges that users working across multiple projects need to know which specific workflow requires their attention without actively polling each project.

**Findings for approach exploration**: Discovery specialists write findings [ref:.claude/envoy/src/lib/findings.ts:FindingsFile:fc672da] capturing multiple approaches with relevant files, clarifying questions, and detailed context. Approaches can have variants (1_A, 1_B) enabling parallel exploration of alternatives. The findings gate [ref:.claude/envoy/src/commands/plan/gates.ts:BlockFindingsGateCommand:0ebeacb] blocks until users review all approaches and either approve, reject variants, or request changes. This pattern surfaces tradeoffs before planning commits to an implementation path.

**Prompts as atomic implementation units**: Each prompt [ref:.claude/envoy/src/lib/prompts.ts:PromptFrontMatter:fc672da] represents one focused task with dependencies, success criteria, and relevant files. Prompts derive from approved findings but add implementation detail - the "how" that specialists will follow. The dependency system ensures prompts execute in valid order while enabling parallelism where dependencies allow.

**Protocol-driven agent behavior**: Rather than embedding workflow logic in agents, protocols [ref:.claude/protocols/implementation.yaml::c15ff37] define numbered steps that agents follow exactly. Protocols support inheritance via extends, enabling debugging protocols to augment implementation protocols with logging steps without duplicating shared logic. The resolution system [ref:.claude/envoy/src/lib/protocols.ts:resolveProtocol:fc672da] handles step merging with replace, append, and insert semantics.

**Walkthrough recording for institutional knowledge**: Implementation records structured walkthroughs [ref:.claude/envoy/src/commands/plan/lifecycle.ts:RecordImplementationCommand:0ebeacb] capturing approach taken, files changed, and decisions made. Walkthroughs track iterations, distinguishing initial implementation from review refinements and testing refinements. This history enables documentation extraction and helps future maintainers understand why code evolved as it did.

**Zod validation for human-authored feedback**: Feedback files [ref:.claude/envoy/src/lib/feedback-schemas.ts::fc672da] are human-edited YAML. Runtime validation catches malformed input before agents process it, providing clear error messages when required fields are missing or types are wrong. This prevents agents from proceeding on invalid feedback that could cause downstream failures.

## Patterns

**Gate blocking via file polling with notification**: Every gate follows the same pattern - write a template YAML file with done: false, send a desktop notification, poll until done: true, then validate and process the response. The 12-hour default timeout acknowledges that human review may take significant time. Gate writes like [ref:.claude/envoy/src/lib/gates.ts:writeFindingsGateFeedback:f3a3dfc], [ref:.claude/envoy/src/lib/gates.ts:writePlanGateFeedback:f3a3dfc], and [ref:.claude/envoy/src/lib/gates.ts:writeTestingGateFeedback:783a982] each trigger appropriate notifications. Token limits on log files prevent context overload when users paste verbose test output.

**Notification context via repo prefix**: Notifications include the repository name in the subtitle alongside the branch name. This enables users working across multiple projects to identify which specific codebase needs attention. The repo name extraction [ref:.claude/envoy/src/lib/git.ts:getRepoName:f0a1170] derives from the git root directory, while branch detection [ref:.claude/envoy/src/lib/git.ts:getBranch:f3a3dfc] handles the current checkout.

**Variant lifecycle for parallel exploration**: Approaches and prompts can have variants (A, B, C) representing alternative solutions to the same problem. All variants of a prompt execute in parallel across worktrees. The variants gate [ref:.claude/envoy/src/commands/plan/gates.ts:BlockPromptVariantsGateCommand:0ebeacb] then determines which becomes main (merged), which are preserved as alternatives, and which are discarded. This pattern enables exploring multiple solutions without sequential bottlenecks.

**Iteration tracking for refinement loops**: Implementation happens in iterations. Initial implementation is iteration 1. Review feedback triggers iteration 2 with type "review-refinement". Failed testing triggers another iteration with type "testing-refinement". Each iteration records its reason, creating a history of how the solution evolved through feedback.

**Debug logging with deterministic cleanup**: Debugging prompts follow a protocol that adds temporary logging with DEBUG-TEMP markers. The logging gate [ref:.claude/envoy/src/commands/plan/gates.ts:BlockDebuggingLoggingGateCommand:0ebeacb] blocks until users capture log output. The cleanup command [ref:.claude/envoy/src/commands/plan/protocols.ts:CleanupDebugLogsCommand:0ebeacb] then removes all markers and associated log lines deterministically. This prevents debug code from persisting into production.

**Findings archival on plan approval**: When users approve the plan gate with no changes, findings are archived [ref:.claude/envoy/src/lib/findings.ts:archiveFindings:fc672da] to a subdirectory. This acknowledges that findings have been consumed by the plan - they remain accessible for reference but no longer drive the active workflow. If the user requests changes, archival is deferred until they approve.

## Use Cases

**Feature development workflow**: User initiates a plan, specialists discover approaches and write findings. The findings gate blocks for review with a notification. User approves approaches (possibly rejecting some variants). Planner creates prompts from approved approaches. Plan gate blocks with notification for prompt review. User approves prompts. The continue command dispatches prompts to specialists, who implement following protocols. Each prompt passes through testing gates if required (each triggering notifications), then variant selection if applicable, then merges to the feature branch. When all prompts merge, the complete command [ref:.claude/envoy/src/commands/plan/lifecycle.ts:CompleteCommand:0ebeacb] generates a PR summary and transitions to completed stage.

**Bug investigation workflow**: Similar to features, but discoveries focus on hypotheses about bug causes. Debug prompts use the debugging protocol, which adds logging gates. User captures logs after receiving notification, specialist analyzes output, implements fix, then cleanup removes debug instrumentation. The structured logging pattern ensures bugs are investigated systematically rather than through ad-hoc code changes.

**Parallel prompt dispatch**: The next command [ref:.claude/envoy/src/commands/plan/lifecycle.ts:NextCommand:0ebeacb] returns prompts whose dependencies are satisfied. The N_PARALLEL_WORKERS environment variable or -n flag controls how many prompts to return. This enables parallel implementation across worktrees, with each specialist working independently on prompts that share no dependencies.

**Mid-workflow user intervention**: Users can edit feedback files at any gate to redirect the workflow. Adding user_required_changes to an approach sends it back for re-investigation. Setting test_passed: false with refinements sends implementation back for iteration. Rejecting a variant removes it from consideration. The gate mechanism makes these interventions part of the normal workflow rather than exceptional interruptions.

**Multi-project attention management**: When working across several repositories, users receive desktop notifications specifying which repo and branch hit a gate. Rather than polling each project or remembering which workflows are in progress, users can respond to gate notifications as they arrive and triage based on urgency. The persistent alert type for gate notifications ensures critical decision points are not missed even when the user is focused elsewhere.
