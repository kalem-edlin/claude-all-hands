---
description: Tree-sitter AST parsing for symbol resolution across 8 languages, enabling documentation references with git-blamed commit hashes.
---

# Tree-sitter Integration

## Overview

Documentation references require locating symbols in source files and tracking their modification history. Tree-sitter provides cross-language AST parsing for symbol extraction. Combined with git blame, produces versioned references that detect documentation staleness.

## Key Decisions

- **Tree-sitter for polyglot AST parsing**: Single library handles TypeScript, JavaScript, Python, Go, Rust, Java, Ruby, Swift [ref:.claude/envoy/src/lib/tree-sitter-utils.ts:parseFile:1c0097c]. No language-specific parsing logic per language.

- **Query-based symbol extraction**: Language-specific queries defined in ast-queries.ts [ref:.claude/envoy/src/lib/ast-queries.ts:languageQueries:605e950]. Declarative patterns capture functions, classes, types, etc. Adding language support = adding queries.

- **WASM for Swift (ABI compatibility)**: Native tree-sitter-swift bindings have ABI issues across Node versions. Swift uses web-tree-sitter WASM runtime instead. Trades speed for reliability.

- **Lazy parser loading**: Parsers loaded on first use per language. Avoids loading all 8 grammars at startup. Reduces memory footprint for single-language repos.

- **Git blame for hash extraction**: Symbol line range fed to git blame. Most recent commit hash becomes reference version. Detects when referenced code changed since documentation written.

- **File-only references for non-AST files**: YAML, JSON, configs can't have symbol references. File-only refs track overall file changes. Enables documentation of any file type.

## Patterns

Reference format: symbol refs (ref:file:symbol:hash) for AST-supported files with symbol, file-only refs (ref:file::hash) for others. Empty symbol slot distinguishes types.

Query structure: each query captures @name (symbol identifier) and @def (full definition range). Range used for git blame. Name used for symbol lookup.

Validation flow: parse doc -> extract refs -> for each ref, parse source file -> find symbol -> git blame range -> compare hashes -> report stale refs.

## Use Cases

- format-reference: agent needs ref to function, provides file and symbol name, gets versioned ref
- validate: CI checks all doc refs, reports stale ones needing update
- Symbol renamed: validation finds "symbol not found", writer investigates and updates
- File modified: hash mismatch detected, writer reviews if prose still accurate
