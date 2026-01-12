---
description: Semantic search system using USearch HNSW indexing and web-ai embeddings for RAG-style documentation retrieval with similarity thresholds.
---

# Knowledge Indexing

## Overview

Documentation becomes useful when discoverable. Knowledge indexing enables semantic search over docs/ directory, returning relevant documentation for natural language queries. Powers RAG-style knowledge retrieval for agents needing codebase context.

## Key Decisions

- **USearch for HNSW indexing**: Fast approximate nearest neighbor search [ref:.claude/envoy/src/lib/knowledge.ts:KnowledgeService:1c0097c]. In-process, no external service dependency. 768-dimension cosine similarity.

- **web-ai embeddings with model caching**: Uses gtr-t5-quant model via @visheratin/web-ai-node. First run downloads model, subsequent runs use cached copy. Avoids repeated network calls.

- **Similarity threshold filtering**: SEARCH_SIMILARITY_THRESHOLD (default 0.65) filters low-relevance results. Prevents noise in search results. Configurable via environment.

- **Token budget limiting**: SEARCH_CONTEXT_TOKEN_LIMIT (default 5000) caps total returned content. Prevents context overflow when many docs match. Higher similarity docs prioritized.

- **Full content for high-similarity matches**: Above SEARCH_FULL_CONTEXT_SIMILARITY_THRESHOLD (default 0.82), returns full document content. Below threshold, metadata only. Reduces noise while providing detail when confident.

- **Front-matter metadata extraction**: Docs require description field in front-matter. Indexed alongside content. Returned with search results for quick relevance assessment.

- **Incremental reindexing**: reindex-from-changes accepts file change list. Updates only affected documents. Enables git hook integration for automatic index maintenance.

## Patterns

Search flow: query -> embed query -> USearch search -> filter by threshold -> sort by similarity -> apply token budget -> return results with metadata

Index storage: .claude/envoy/.knowledge/ contains docs.usearch (vector index) and docs.meta.json (document metadata mapping IDs to paths and front-matter).

Reindex triggered by: explicit reindex-all command, git hooks on doc changes, or when index missing/corrupted.

## Use Cases

- Agent needs context on auth: searches "authentication flow", gets relevant docs with code refs
- Documentation writer checks existing coverage: searches concept before writing to avoid duplication
- Incremental indexing: post-commit hook calls reindex-from-changes with modified docs
- Token-efficient retrieval: metadata-only mode returns paths/descriptions for initial filtering
