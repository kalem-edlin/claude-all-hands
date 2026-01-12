---
description: Manifest-based file sync architecture using .internal.json exclusions and gitignore filtering, enabling selective distribution without git submodules.
---

# Sync Architecture

## Overview

claude-all-hands syncs agent configurations via file distribution rather than git submodules. Source repo maintains canonical configs; consumer repos receive copies. Bidirectional flow: consumers pull updates, push improvements back.

Why not submodules: Submodules create version coupling, complicate consumer workflows, require consumers understand git internals. File distribution treats configs as first-class project files - visible, editable, committable without submodule ceremony.

## Key Decisions

**Manifest-driven distribution**: [ref:src/lib/manifest.ts:Manifest:5454985] determines which files sync. Two-layer filtering: `.internal.json` marks files internal to source repo (never distributed), `.gitignore` excludes build artifacts. File distributes if it passes both filters.

**Internal vs distributable separation**: [ref:.internal.json::545cdcb] lists patterns for files that exist in source but shouldn't propagate - source repo's package.json, CI configs, build scripts. Consumers get clean subset without source repo's operational files.

**Byte-level comparison**: [ref:src/lib/manifest.ts:filesAreDifferent:d53e5c3] compares files byte-for-byte rather than hash-based. Guarantees accuracy for conflict detection without maintaining hash database. Size check first avoids reading identical large files.

**GitignoreFilter for nested rules**: [ref:src/lib/gitignore.ts:GitignoreFilter:5454985] walks directory tree, parses all .gitignore files at each level, applies rules in order. Handles negation patterns (!pattern) correctly. Necessary because source repo may have nested .gitignore files.

**Source root resolution**: [ref:src/lib/paths.ts:getAllhandsRoot:5454985] supports two modes - env var ALLHANDS_PATH for local development, package-relative path for npx usage. Bundled CLI resolves relative to bin/cli.js location.

## Patterns

Manifest instantiation always uses allhands root (source), not target repo. Consumer's .gitignore doesn't affect what's available to sync - source repo controls distributable set.

Conflict detection happens before any writes. If files differ, user chooses resolution (backup/overwrite/cancel) once for all conflicts, not per-file. Prevents partial updates on cancel.

## Use Cases

**Adding new agent type**: Add files to source repo, ensure not listed in .internal.json. Next consumer update automatically includes new agent.

**Excluding source-only tooling**: Add pattern to .internal.json for files that help develop/test configs but shouldn't be in consumer repos (test fixtures, CI scripts).

**Per-directory ignore rules**: Source repo can have .gitignore at any level. GitignoreFilter respects hierarchy - nested .gitignore can exclude files from subdirectory without affecting parent patterns.
