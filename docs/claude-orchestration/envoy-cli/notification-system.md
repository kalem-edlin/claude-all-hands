---
description: Native macOS notifications via jamf/Notifier for gate alerts and hook events with branch context auto-detection.
---

# Notification System

## Overview

Agents run in background. Users need awareness of blocking gates requiring action and significant events. Notification system pushes native macOS alerts when user attention needed, avoiding constant terminal monitoring.

## Key Decisions

- **jamf/Notifier for macOS native notifications**: Uses Notifier.app [ref:.claude/envoy/src/lib/notification.ts:sendNotification:dc78cf3] rather than terminal-bound alerts. Notifications appear in system notification center, persist until dismissed.

- **Banner vs Alert types**: Banners auto-dismiss (for informational hooks). Alerts persist until clicked (for blocking gates). Ensures critical gates don't get missed in notification flood.

- **Branch context in subtitle**: Auto-detects current branch, includes repo name. User sees which feature/plan needs attention without switching context.

- **Graceful degradation**: If Notifier not installed, logs warning and continues. Notifications are enhancement, not requirement. Command execution unaffected.

- **Structured notification layout**: Title = event type, Subtitle = branch context, Message = specific details. Consistent format enables quick scanning.

## Patterns

Gate notifications: sendGateNotification() uses alert type. Called when feedback file written, blocks until user sets done:true.

Hook notifications: sendHookNotification() uses banner type. Informational, doesn't require immediate action.

Discovery: checks /Applications/Utilities/Notifier.app first, then PATH. Supports both installed app and CLI tool modes.

## Use Cases

- Plan gate triggered: user gets persistent alert "Plan Gate - feature-branch - Plan ready for review"
- Testing gate needs feedback: alert persists in notification center until user reviews test results
- Agent stopped via hook: banner notification "Agent Stopped - Summarized completed work"
- Notifier not installed: logs skip message, no notification sent, command succeeds
