---
description: Multi-LLM provider abstraction supporting Gemini and OpenAI with unified interface, lazy-loading, and provider-agnostic oracle commands.
---

# Provider Abstraction

## Overview

Oracle commands require LLM access for validation, auditing, and review. Rather than hardcoding a single provider, the system abstracts LLM access behind a unified interface. Supports swapping providers via environment config without code changes.

## Key Decisions

- **Provider interface abstraction**: LLMProvider interface [ref:.claude/envoy/src/lib/providers.ts:LLMProvider:cd7f2ef] defines generate(), getApiKey(), and config. Implementations for Gemini [ref:.claude/envoy/src/lib/gemini-provider.ts::cd7f2ef] and OpenAI [ref:.claude/envoy/src/lib/openai-provider.ts::cd7f2ef] conform to same contract.

- **Lazy provider instantiation**: createProvider() [ref:.claude/envoy/src/lib/providers.ts:createProvider:cd7f2ef] dynamically imports provider implementations. Avoids loading unused SDKs, reduces startup time when provider not needed.

- **Environment-based default selection**: ORACLE_DEFAULT_PROVIDER env var chooses default. Falls back to Gemini. Per-command --provider flag overrides default.

- **Centralized config**: PROVIDER_CONFIGS [ref:.claude/envoy/src/lib/providers.ts:PROVIDER_CONFIGS:cd7f2ef] maps provider names to API key env vars, default/pro model names. Single source of truth for provider details.

- **Tier-based model selection**: Each provider has default (fast) and pro (capable) models. Commands choose tier based on task complexity: validation uses default, audit/review use pro.

## Patterns

Oracle commands extend OracleCommand base class. initProvider() validates API key presence. callProvider() wraps generate() with retry logic. callAndParse() combines LLM call with JSON extraction from response.

Provider implementations are thin wrappers around vendor SDKs. Gemini uses @google/genai with Vertex AI mode. OpenAI uses standard completion API. Both normalize response to {text, model} structure.

## Use Cases

- User has OpenAI key only: set ORACLE_DEFAULT_PROVIDER=openai, all oracle commands use OpenAI
- Fallback scenarios: retry system provides fallback suggestions when provider unavailable
- Testing different models: --provider flag enables A/B comparison without config changes
- Adding new provider: implement LLMProvider interface, add to createProvider switch
