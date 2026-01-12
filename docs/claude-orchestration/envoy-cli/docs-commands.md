---
description: Documentation tooling for symbol reference formatting, validation, complexity metrics, and coverage analysis using tree-sitter AST parsing.
---

# Documentation Commands

## Overview

Documentation requires references to source code that stay synchronized as code evolves. Docs commands [ref:.claude/envoy/src/commands/docs.ts::1c0097c] provide tooling for creating versioned references, validating reference freshness, measuring complexity, and analyzing documentation coverage.

## Key Decisions

- **Git blame for version tracking**: References include commit hash from git blame. When code changes, hash mismatch indicates stale documentation.

- **Symbol vs file-only references**: AST-supported files can have symbol references (format: ref:file:symbol:hash). Non-AST files use file-only refs (format: ref:file::hash). Different validation logic for each.

- **Front-matter validation**: Docs must have YAML front-matter with description field. Enables semantic search indexing, enforces documentation quality.

- **Inline code detection**: Validation flags fenced code blocks. Documentation should reference code, not duplicate it. Enforces separation of concerns.

- **Capability list detection**: Warns on tables with Command/Purpose headers. Indicates capability documentation rather than knowledge documentation.

- **Placeholder hash detection**: Catches abc123, 000000, etc. Ensures writers use format-reference command rather than writing refs manually.

- **By-doc-file grouping**: Validation output groups issues by documentation file. Enables efficient delegation to documentation-writer agents for fixes.

## Patterns

Reference creation: envoy docs format-reference file symbol -> parses file with tree-sitter -> finds symbol -> git blame symbol range -> returns formatted reference string

Validation: scan docs/ for markdown -> extract refs via regex -> for each ref, validate file exists + symbol exists + hash matches current -> report stale/invalid

Complexity metrics: tree-sitter counts functions, classes, imports. Lines estimated at 10 tokens each. Helps assess documentation effort needed.

## Use Cases

- Writer needs reference: calls format-reference, gets versioned ref to paste in docs
- CI validation: docs validate runs in pipeline, fails on stale refs
- Coverage analysis: docs tree shows which source files lack documentation
- Stale ref fix: validation reports stale refs, writer regenerates reference and updates prose if needed
