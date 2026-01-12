---
description: User notification hooks - stop events, permission requests, input waiting states, desktop alerts.
---

# Notification Hooks

## Overview

Notification hooks alert users when Claude Code reaches states requiring attention. They bridge autonomous agent operation with user awareness - agents run independently, but users get notified when input needed, when work completes, or when permissions require approval.

## Key Decisions

- **Envoy-based notifications**: All notification hooks route through `envoy notify hook` command. This provides consistent notification mechanism across platforms, centralized configuration, and uniform message formatting.

- **Non-blocking design**: Notification hooks output `{"continue": true}` - they never block workflow. Notification is best-effort; failure doesn't stop agent operation. This prevents notification system issues from breaking core functionality.

- **Event-specific messages**: Different hooks provide contextual messages. Stop [ref:.claude/hooks/notify_stop.sh::9fa5369] says "Agent Stopped - Ready for next prompt". Idle [ref:.claude/hooks/notify_idle.sh::9fa5369] says "Waiting for input". Permission [ref:.claude/hooks/notify_permission.sh::6bde9f0] includes tool name requiring permission. Context helps user prioritize attention.

- **Permission tool extraction**: Permission notification hook parses stdin JSON to extract tool_name, includes it in notification. User knows "Permission requested for Bash" vs generic "Permission requested" - more actionable.

## Patterns

**Silent failure handling**: Notifications use `2>/dev/null || true` pattern. If envoy or notification system unavailable, hook proceeds silently. Agent operation prioritized over notification delivery.

**Stdin consumption**: Permission hook reads stdin to get tool info. Important because hook receives JSON with tool_name, tool_input. Other hooks don't need stdin data, so they skip reading it.

**Event type differentiation**: Envoy notify command takes event type parameter (hook, question, permission). Enables different notification behaviors per event type - sound, priority, grouping.

## Technologies

**Claude Code hook system**: Hooks configured in .claude/hooks.json (not present in this repo - hooks defined elsewhere or using default locations). Hooks fire on events: Stop, Notification (idle), PreToolUse (permission).

**Python hook model**: Hooks can be shell scripts or Python. Python hooks read JSON from stdin, output JSON to stdout. Shell hooks work with simpler string-based I/O.

## Use Cases

- **Agent completes work**: Agent finishes task, attempts to stop. Stop hook fires [ref:.claude/hooks/notify_stop.sh::9fa5369] → sends "Agent Stopped" notification → user receives desktop alert → knows to review results.

- **Agent waiting for input**: Agent reaches AskUserQuestion. Notification/idle event fires → notify_idle hook sends "Waiting for input" → user sees notification → returns to provide answer.

- **Permission required**: Agent attempts tool requiring approval. PreToolUse fires on permission-required tool → notify_permission extracts tool name → notification "Permission requested for Write" → user reviews and approves.
