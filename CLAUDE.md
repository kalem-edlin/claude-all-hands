# Agent Orchestration System

## Core Rule

Parent agent: SOLE code modifier. Subagents: READ-ONLY, return needed information/implementation.

## Project Rules

- Never leave comments that mark a update in code given a user prompt to change code.

## Git

- Branches: feat/, chore/, fix/, refactor/, exp/, docs/
- Commits: Extremely concise, sacrifice grammar for concision

## Human Checkpoints

Ask before: creating agents/skills, external API calls, architectural decisions

## claude-envoy Errors

When any subagent reports an `envoy` command failure:
1. Use AskUserQuestion: "[Tool] failed: [error]. Options: (A) Retry, (B) [inferred alternative], (C) Skip"
2. In auto-accept mode: Infer best alternative and proceed
