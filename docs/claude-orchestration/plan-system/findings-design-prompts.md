---
description: Three-artifact structure separating investigation findings, design assets, and implementation prompts to enable staged review and variant exploration.
---

# Findings, Design, and Prompts Structure

## Overview

Plan directories separate concerns into three artifact types: findings capture specialist investigation results and proposed approaches; design holds UI mockups and visual specifications; prompts define discrete implementation tasks. This separation enables independent review cycles and variant exploration before committing to implementation.

## Key Decisions

**Findings as approach proposals**: Findings files [ref:.claude/envoy/src/lib/findings.ts:FindingApproach:fc672da] capture specialist domain expertise. Each approach includes description, relevant files, clarifying questions, and detailed context. Approaches are numbered and can have A/B/C variants for alternative strategies.

**Variant mutual exclusion**: Standalone approaches (no variant letter) and variant approaches (with letter) cannot coexist for same number. WriteApproachCommand [ref:.claude/envoy/src/commands/plan/findings.ts:WriteApproachCommand:0ebeacb] enforces this constraint - prevents ambiguous state where both a base approach and its variants exist.

**Prompts as implementation specs**: Prompts [ref:.claude/envoy/src/lib/prompts.ts:PromptFrontMatter:fc672da] are derived from approved approaches. Each prompt declares relevant files, success criteria, dependencies, and whether manual testing required. Prompts track their own lifecycle: unimplemented -> implemented -> reviewed -> tested -> merged.

**Design manifest for visual specs**: Design directory holds screenshot/mockup files with a `design_manifest.yaml` describing each file. Prompts reference specific design files via `design_files` field, linking implementation to visual requirements.

**Walkthrough capture**: As agents implement prompts, they record walkthroughs with iteration number, type (initial/review-refinement/testing-refinement), approach description, and key decisions. This enables documentation extraction post-completion.

## Patterns

**Approach to prompt transformation**: Approved findings approaches become prompt context. The planner reads GetFindingsCommand [ref:.claude/envoy/src/commands/plan/findings.ts:GetFindingsCommand:0ebeacb] output including user_requested_changes and question_answers, then generates prompts via WritePromptCommand [ref:.claude/envoy/src/commands/plan/prompts.ts:WritePromptCommand:0ebeacb] incorporating that feedback.

**Dependency validation**: ValidateDependenciesCommand [ref:.claude/envoy/src/commands/plan/prompts.ts:ValidateDependenciesCommand:0ebeacb] detects stale prompts - prompts whose dependencies were modified after the prompt was planned. This catches situations where upstream prompt changes invalidate downstream assumptions.

**Debug vs feature kind**: Prompts have `kind: debug` or `kind: feature`. Debug prompts get prioritized in next-prompt ordering and use logging gate instead of testing gate. Debug prompts exist for diagnosing issues, not shipping features.

## Use Cases

**Specialist investigation**: Backend specialist investigates API requirements, writes findings with approaches for data model, validation, endpoints. Frontend specialist investigates component needs, writes approaches for UI patterns. Each specialist has own findings file.

**Variant competition**: Approach 1 has variants A (hooks-based) and B (context-based). Both get developed in parallel worktrees if resources allow. Testing gate verifies both variants work. Variants gate lets human select winner or keep both via feature-flag.

**Refinement iteration**: User rejects initial approach at findings gate with change request. Agent retrieves approach via GetFindingApproachCommand, sees `user_requested_changes` populated, generates refined approach incorporating feedback.
