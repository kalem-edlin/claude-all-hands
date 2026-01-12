---
description: Generic retry utility with exponential backoff for external API calls, detecting retryable errors and providing fallback suggestions.
---

# Retry Resilience

## Overview

External APIs fail. Network issues, rate limits, server errors all interrupt workflows. Retry system provides resilient API access with intelligent backoff, distinguishing transient failures from permanent errors.

## Key Decisions

- **Generic retry wrapper**: withRetry() [ref:.claude/envoy/src/lib/retry.ts:withRetry:fc672da] wraps any async function. Works with any external service, not just LLM providers.

- **Exponential backoff with cap**: Delay doubles each retry (1s -> 2s -> 4s -> 8s max). Prevents hammering failing services while allowing quick recovery from brief outages.

- **Retryable error detection**: Inspects error messages for network errors, 429/rate limits, 5xx server errors. Non-retryable errors (4xx client errors, auth failures) fail immediately without wasting retries.

- **Fallback suggestions**: Oracle commands provide endpoint-specific fallbacks. When all retries exhausted, suggests alternative action (e.g., "Skip audit and proceed with user review only").

- **Configurable limits**: maxRetries (default 3), initialDelayMs (1000), maxDelayMs (8000), backoffMultiplier (2) all configurable per call site.

- **Retry count in response**: Both success and error responses include retry count. Enables monitoring retry frequency, detecting degraded services.

## Patterns

Usage: result = await withRetry(() => apiCall(), "service.endpoint", options, fallbackSuggestion)

RetryResult discriminated union: {success: true, data, retries} or {success: false, error, retries, fallback_suggestion}. Caller handles both cases explicitly.

Error classification: message string matching for common patterns. Simple but effective - covers 95% of cases without complex error type hierarchies.

## Use Cases

- LLM rate limit: first call hits 429, retries with backoff, succeeds on third attempt
- Network outage: all retries fail, returns error with fallback suggestion
- Server 503: retries detect 5xx, backs off, recovers when service returns
- Auth error: 401/403 not retryable, fails immediately with clear error
