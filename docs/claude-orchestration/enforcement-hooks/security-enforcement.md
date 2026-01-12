---
description: Security enforcement hooks - research tool blocking, GitHub URL redirection, capability restriction patterns.
---

# Security Enforcement

## Overview

Hooks enforce security boundaries that Claude Code's base permission system cannot express. The system blocks certain tool uses entirely, redirects others to safer alternatives, and ensures capability isolation between agents. This prevents accidental information leakage and enforces architectural constraints.

## Key Decisions

- **Research capability isolation**: Only researcher agent should perform web searches. The enforce_research_search hook [ref:.claude/hooks/enforce_research_search.py::0c5b580] blocks WebSearch tool for all agents, returning denial message that instructs main agent to delegate to researcher or subagent to request delegation.

- **Fetch redirection**: Web fetching blocked via enforce_research_fetch [ref:.claude/hooks/enforce_research_fetch.py::0c5b580]. Agents must use `envoy tavily extract` instead, routing through controlled tooling. This ensures consistent URL handling and prevents direct web access that could bypass rate limits or logging.

- **GitHub URL interception**: The github_url_to_gh hook [ref:.claude/hooks/github_url_to_gh.py::e99bf1f] catches GitHub URLs in WebFetch and curl/wget commands, redirecting to `gh` CLI. GitHub API has better rate limits, authentication, and consistent response format compared to raw scraping.

- **Blocking over prompting**: Security hooks use `permissionDecision: deny` rather than approval prompts. User shouldn't need to decide whether research isolation is enforced - it always is. This prevents social engineering and decision fatigue.

## Patterns

**PreToolUse blocking**: Security hooks run PreToolUse to intercept before execution. They examine tool_input, make enforcement decision, return deny with clear reason explaining what to do instead. Agent receives actionable guidance, not just "blocked".

**Domain-based matching**: GitHub hook checks URL domains (github.com, raw.githubusercontent.com, gist.github.com) across multiple tools (WebFetch, Bash with curl/wget/tavily). Single enforcement point for cross-cutting concern.

**Graceful redirection**: Denial messages include the alternative. "Use 'gh' CLI: gh api repos/OWNER/REPO/contents/PATH" tells agent exactly how to proceed. Enforcement without frustration.

## Use Cases

- **Main agent attempts web search**: User asks question requiring external info. Main agent tries WebSearch → hook blocks → agent sees message to delegate to researcher → delegates properly → researcher performs search via envoy.

- **Subagent needs documentation**: Specialist needs library docs. Attempts WebFetch → blocked → sees message to use `envoy tavily extract` → uses proper tooling → gets content with consistent handling.

- **GitHub file access**: Agent needs to read a GitHub file. Attempts curl with raw.githubusercontent URL → hook blocks → redirect message to use gh CLI → uses `gh api` → gets content with proper auth and rate limiting.
