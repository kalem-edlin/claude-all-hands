---
description: esbuild bundling strategy and npm packaging with dotfile restoration for files npm hardcode-excludes during publish.
---

# Build and Packaging

## Overview

CLI distributed via npm, bundled with esbuild into single executable. Bundling simplifies installation (no node_modules resolution at runtime), enables npx claude-all-hands workflow. Dotfile restoration handles npm's hardcoded exclusions.

## Key Decisions

**Single-file bundle**: [ref:package.json::af26d3b] build script bundles src/cli.ts to bin/cli.js with esbuild. ESM format, Node 18 target. Shebang banner makes executable. All dependencies (yargs, minimatch) bundled - zero runtime node_modules.

**yargs for CLI parsing**: [ref:src/cli.ts::45a2fe3] uses yargs declarative command definition. Subcommands (init, update, push, pull-manifest) each get positional args and options. Strict mode rejects unknown flags. Version from package.json via createRequire.

**Dotfile restoration post-copy**: [ref:src/lib/dotfiles.ts:restoreDotfiles:d4e99d7] renames gitignore to .gitignore, npmrc to .npmrc after copying. npm publish hardcode-excludes dotfiles regardless of .npmignore settings. Source ships without dots, init/update restore dots in target.

**prepublishOnly build hook**: Package.json runs build before npm publish. Ensures bin/cli.js always fresh. No separate publish script needed.

## Patterns

Bundle includes all code but not distributed files. Distributed files (agents, prompts, configs) remain as files in package - manifest reads them at runtime. Bundle is the CLI, distributed files are the payload.

Dotfile restoration is idempotent - skips if target dotfile exists. Prevents overwriting user's .gitignore customizations during update.

Path resolution in bundled code uses import.meta.url to find package root. Works whether invoked via npx (temp install) or global install (permanent location).

## Use Cases

**npx installation**: User runs `npx claude-all-hands init .` - npm downloads package, runs bundled CLI, CLI copies distributed files including restoring dotfiles. No prior installation needed.

**Local development**: Set ALLHANDS_PATH env var pointing to repo root. CLI uses env var instead of package-relative path. Enables testing changes without rebuilding/republishing.

**Version pinning**: Consumer can install specific version `npx claude-all-hands@1.0.x init .` Package version in package.json tracks distributed file versions. Update to newer CLI version brings newer configs.
