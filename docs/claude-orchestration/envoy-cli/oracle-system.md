---
description: Oracle commands providing LLM-powered plan validation, architecture analysis, audit, and review with structured prompts and JSON response parsing.
---

# Oracle System

## Overview

Oracle commands leverage external LLMs to provide judgment on agent-generated plans and implementations. They enforce quality gates, catch over-engineering, and provide structured feedback. Critical for human-in-the-loop oversight without requiring constant manual review.

## Key Decisions

- **Validation focuses on anti-overengineering**: validate command [ref:.claude/envoy/src/commands/oracle.ts::e99bf1f] explicitly checks if plan exceeds stated requirements. Prevents agents from gold-plating simple requests.

- **Structured JSON responses**: All oracle commands return JSON with verdict, thoughts, questions, suggestions. Enables programmatic handling of results, not free-form text interpretation.

- **Binary validation verdicts**: valid/invalid only. Removes ambiguity. Invalid requires action, valid proceeds to user approval. No "maybe" states that stall workflow.

- **Clarifying questions as blocking gates**: When audit/review needs user input, questions are written to feedback files. Command blocks until user answers. Ensures human insight incorporated before proceeding.

- **Image support for design review**: Audit command can include design screenshots as inline data. Enables visual review of UI plans against mockups.

- **Pro model for complex tasks**: Audit and review use pro-tier models. More capable reasoning for nuanced judgment. Validate/ask use default tier for speed.

## Patterns

Each oracle command defines SYSTEM_PROMPT with evaluation criteria and expected JSON structure. User context (plan, prompts, diffs) assembled into full prompt. Response parsed for JSON, extracted fields returned as command result.

Questions flow: oracle returns questions -> writeQuestionsFeedback() creates YAML file -> watchForDone() polls for done:true -> readQuestionsFeedback() extracts answers -> answers appended to user_input.md

## Use Cases

- Plan validation: agent writes plan, oracle validate checks scope creep, returns edits needed
- Architecture analysis: complex feature request -> oracle architect proposes approaches with tradeoffs
- Audit gate: plan complete -> oracle audit reviews for completeness, asks clarifying questions
- Implementation review: prompt implemented -> oracle review checks against success criteria
- Full plan review: all prompts done -> oracle review --full evaluates integration
