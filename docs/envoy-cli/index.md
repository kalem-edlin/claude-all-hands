---
description: >-
  Agent-scoped CLI providing external tool access through a unified command
  interface with auto-discovery, JSON-only output, observability
  instrumentation, desktop notifications for human-in-the-loop visibility,
  and retry resilience for external API calls.
---

# Envoy CLI

## Overview

Envoy solves the problem of giving Claude agents controlled access to external tools and services without embedding API credentials or complex logic in agent prompts. Rather than requiring agents to construct raw API calls or manage authentication, envoy provides a command-line interface that wraps external services with consistent error handling, observability, and retry logic. Agents invoke envoy commands and receive structured JSON responses they can parse and act upon.

The design prioritizes agent consumption over human interaction. Every command outputs JSON with explicit status fields, making it trivial for agents to branch on success or failure. Error responses include suggestions for recovery, enabling agents to handle failures gracefully rather than halting execution.

A key design principle is human-in-the-loop visibility. When agents hit blocking gates that require human decisions, the notification system ensures users are alerted immediately rather than discovering blocked workflows later. This bridges the gap between autonomous agent operation and the human attention needed at critical decision points.

## Key Decisions

**JSON-only output for agent consumption**: All commands return structured JSON with status, data, error, and metadata fields. This removes ambiguity in agent parsing and enables reliable error handling. The response structure is defined in [ref:.claude/envoy/src/commands/base.ts::e99bf1f] with explicit types for success and error cases.

**Auto-discovery command architecture**: Commands are organized into groups (git, docs, knowledge, oracle, etc.) with subcommands auto-discovered at startup. The discovery mechanism [ref:.claude/envoy/src/commands/index.ts:discoverCommands:0ebeacb] scans the commands directory for modules exporting a COMMANDS object. This enables adding new commands by creating a file without modifying the CLI entry point [ref:.claude/envoy/src/cli.ts::e99bf1f].

**Response stripping for context efficiency**: The base command implementation automatically strips empty values (empty strings, empty arrays, null, undefined) from responses. The [ref:.claude/envoy/src/commands/base.ts:stripEmpty:fc672da] method recursively cleans response data, reducing token overhead when agents parse envoy output in their context windows.

**Observability instrumentation on every command**: Every command execution logs start and completion events via [ref:.claude/envoy/src/lib/observability.ts:logCommandStart:e99bf1f]. This creates audit trails for debugging workflow issues and understanding command performance across agent sessions.

**Retry with exponential backoff for external APIs**: External service calls use [ref:.claude/envoy/src/lib/retry.ts:withRetry:fc672da] which implements exponential backoff with jitter. Retryable errors (network issues, rate limits, 5xx responses) trigger automatic retry with configurable delays. Non-retryable errors fail immediately. This prevents transient failures from blocking agent workflows while avoiding infinite loops.

**Branch-aware plan context**: Git utilities automatically detect the current branch and derive plan context. The [ref:.claude/envoy/src/lib/git.ts:getPlanDir:fc672da] function maps branch names to plan directories, while [ref:.claude/envoy/src/lib/git.ts:isDirectModeBranch:fc672da] identifies branches that bypass planning (protected branches, curator/ prefix). This branch-to-plan mapping enables stateful workflows without explicit configuration.

**Desktop notifications for gate blocking visibility**: When agents hit blocking gates requiring human input, the notification system [ref:.claude/envoy/src/lib/notification.ts::dc78cf3] sends desktop alerts using jamf/Notifier on macOS. Notifications include repo context via [ref:.claude/envoy/src/lib/git.ts:getRepoName:f0a1170] and branch via [ref:.claude/envoy/src/lib/git.ts:getBranch:f3a3dfc], enabling users working across multiple projects to identify which workflow needs attention. Gate notifications persist until dismissed (alert type), ensuring critical decision points are not missed.

## Patterns

**Command group organization**: Each command file (oracle.ts, tavily.ts, etc.) exports a COMMANDS object mapping subcommand names to class constructors. Classes extend a base that provides shared utilities: file reading, timed execution, success/error response builders. The router in the CLI entry point instantiates commands on demand and wires up argument parsing.

**External service integration**: Service-specific commands (Oracle [ref:.claude/envoy/src/commands/oracle.ts::e99bf1f], Perplexity [ref:.claude/envoy/src/commands/perplexity.ts::fc672da], Tavily [ref:.claude/envoy/src/commands/tavily.ts::fc672da], xAI [ref:.claude/envoy/src/commands/xai.ts::fc672da]) share a common pattern: check API key from environment, call external API with timeout, parse response, return structured result. Each service has its own timeout and retry behavior tuned to its characteristics.

**Documentation reference tracking**: The docs command group [ref:.claude/envoy/src/commands/docs.ts::23e9729] provides symbol reference formatting with git blame hashes and validation of existing references. This supports the documentation workflow where code mentions become versioned references that can be validated for staleness.

**Semantic search via knowledge commands**: The knowledge group [ref:.claude/envoy/src/commands/knowledge.ts::6607b05] exposes the [ref:.claude/envoy/src/lib/knowledge.ts:KnowledgeService:6607b05] for semantic document search. Documents are embedded using a local model and indexed with USearch. Search returns similarity-ranked results with optional full content for high-confidence matches.

**Git operation wrappers**: The git command group [ref:.claude/envoy/src/commands/git.ts::fc672da] wraps common git operations (base branch detection, diff generation, PR creation, worktree cleanup). These commands encode workflow conventions like branch naming and merge commit tracking rather than exposing raw git primitives.

**Budget-aware code extraction**: The repomix commands [ref:.claude/envoy/src/commands/repomix.ts::fc672da] provide estimate-first extraction via [ref:.claude/envoy/src/lib/repomix.ts:runRepomix:fc672da]. Agents can check token counts before extracting large codebases, preventing context overflow. The estimate command returns token counts without content, while extract returns the full context.

**Notification layering for event types**: The notification system [ref:.claude/envoy/src/lib/notification.ts:sendNotification:dc78cf3] distinguishes event types through notification behavior. Gate notifications [ref:.claude/envoy/src/lib/notification.ts:sendGateNotification:f3a3dfc] use persistent alerts that require dismissal because gates represent blocking decisions. Hook notifications [ref:.claude/envoy/src/lib/notification.ts:sendHookNotification:f3a3dfc] use auto-dismissing banners for informational events like agent stops. This semantic distinction helps users prioritize their attention.

## Technologies

Envoy is built on Commander.js for CLI argument parsing, with TypeScript compiled to ESM modules. External API calls use native fetch with AbortController for timeouts. The embedding model uses web-ai-node with ONNX runtime for local inference. Vector indexing uses USearch for HNSW-based similarity search. YAML front-matter parsing uses gray-matter for documentation files. Desktop notifications use jamf/Notifier for macOS system integration.

## Use Cases

**Agent accesses external research**: When an agent needs current information beyond its training data, it invokes envoy perplexity research or envoy tavily search. These commands handle authentication, rate limiting, and timeout, returning structured results the agent can synthesize into its response.

**Documentation references remain valid**: Writers use envoy docs format-reference to generate versioned references. The validate command checks references against current source, identifying stale or broken links before documentation is committed.

**Semantic knowledge retrieval**: Before implementing a feature, agents call envoy knowledge search to find relevant existing patterns. The search returns similarity-ranked documentation with optional full content, providing implementation context without manual file discovery.

**Plan-aware git operations**: The continue command uses envoy git commands to manage worktrees, detect base branches, and create PRs. These operations are plan-aware, automatically deriving context from the current branch and prompt metadata.

**Code budget estimation**: Before reading a large directory, agents call envoy repomix estimate to check token counts. If the estimate exceeds budget, they can narrow scope before calling extract, preventing context exhaustion.

**Human attention at blocking gates**: When agents create findings, plan, testing, or variant gates, the notification system immediately alerts the user with repo and branch context. Users working across multiple projects can identify which workflow needs review without polling each project. The notify command group [ref:.claude/envoy/src/commands/notify.ts::f3a3dfc] also exposes notifications for hooks and custom agent events.
