---
description: Log-based observability via envoy.log with structured JSON entries, automatic string/structure truncation, and command timing instrumentation.
---

# Observability

## Overview

When agents fail or behave unexpectedly, understanding what happened requires visibility into command execution. Observability system writes structured log entries for every command invocation, enabling post-hoc debugging and pattern analysis.

## Key Decisions

- **Log file over external service**: Writes to .claude/envoy.log [ref:.claude/envoy/src/lib/observability.ts:log:8f91327]. No external dependencies, works offline, simple grep/jq analysis. Avoids cloud service complexity for local development.

- **Structured JSON entries**: Each log line is complete JSON with timestamp, level, command, args, result, duration, agent name, branch, plan_name. Enables programmatic analysis.

- **String truncation**: MAX_LOG_STRING_LENGTH (default 200) prevents verbose content from bloating logs. Long prompts/responses summarized with ellipsis.

- **Structure truncation**: MAX_LOG_DEPTH (2), MAX_LOG_ARRAY_ITEMS (3), MAX_LOG_OBJECT_KEYS (5) prevent deeply nested structures from overwhelming logs. Deep objects replaced with summary like "{5 fields}".

- **Silent failure**: Log writes wrapped in try/catch with silent fail. Observability should never break command execution. Missing logs preferable to failed commands.

- **Plan name derivation**: Branch name parsed to extract plan name (strips /implementation-* suffix). Groups related log entries across worktree branches.

- **Agent attribution**: --agent flag passed to commands, included in log entries. Enables filtering logs by originating agent.

## Patterns

BaseCommand.executeWithLogging() wraps execute(). Logs command start with args, then completion with status, duration, and result context. Timing via performance.now().

Log levels: info (normal operations), warn (retries, degraded behavior), error (failures). Command failures always logged as error level.

## Use Cases

- Debug agent stuck on task: grep envoy.log for agent name, see command sequence and errors
- Performance analysis: extract duration_ms from logs, identify slow commands
- Error pattern detection: count error types across sessions, find systemic issues
- Plan forensics: filter by plan_name, trace entire feature development
