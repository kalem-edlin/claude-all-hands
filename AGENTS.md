# AGENTS.md

## Project Overview
CLI tool for syncing Claude agent configurations across repositories. Built with TypeScript, uses esbuild for bundling, follows ES module patterns.

## Build Commands

```bash
# Build the CLI
npm run build

# Development mode with watch
npm run dev

# Prepare for publish
npm run prepare
```

## Testing
No test framework is configured. Tests are currently documentation-based or manual.

## Code Style Guidelines

### TypeScript Configuration
- **Target**: ES2022, **Module**: ESNext
- **Strict mode**: Enabled with all strict flags
- **Module resolution**: Node
- **Output**: ES modules with .js extensions

### Import Conventions
```typescript
// Use .js extensions for local imports (ESM requirement)
import { git } from '../lib/git.js';
import { cmdInit } from './commands/init.js';

// Node built-ins use bare names
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
```

### Naming Conventions
- **Files**: kebab-case (e.g., `sync-back.ts`, `check-ignored.ts`)
- **Functions**: camelCase with descriptive names
- **Interfaces**: PascalCase, exported when used across modules
- **Constants**: UPPER_SNAKE_CASE for top-level constants
- **Classes**: PascalCase

### File Structure
```
src/
├── cli.ts              # Main entry point
├── commands/           # CLI command implementations
└── lib/               # Shared utilities and types
```

### Error Handling Patterns
```typescript
// Process exit for CLI errors
if (!checkGitInstalled()) {
  console.error('Error: git is not installed. Please install git first.');
  process.exit(1);
}

// Return codes for commands
export async function cmdInit(): Promise<number> {
  try {
    // implementation
    return 0; // success
  } catch (err) {
    console.error('Error:', err.message);
    return 1; // failure
  }
}

// Result objects for operations
export interface GitResult {
  success: boolean;
  stdout: string;
  stderr: string;
}
```

### Type Definitions
- Export interfaces used across modules
- Use specific return types (Promise<number> for commands)
- Leverage TypeScript's strict mode for safety

### Git Workflow
- **Branch prefixes**: feat/, chore/, fix/, refactor/, exp/, docs/
- **Commits**: Conventional, focus on "why" over "what"
- **Hooks**: Pre-commit checks for manifest coverage and sync-back warnings

### Package Management
- **Node version**: >=18
- **Package manager**: npm (but supports pnpm lock file)
- **Build tool**: esbuild for fast bundling
- **Binary**: Generated in bin/cli.js with shebang

## Development Notes

### Manifest System
The project uses `.allhands-manifest.json` to define distribution patterns:
- `distribute`: Files synced to target repos
- `internal`: Source-only files
- `exclude`: Files never synced

### Environment Variables
- `ALLHANDS_PATH`: Override allhands root for local dev
- Standard Node environment variables

### Dependencies
- **Core**: yargs for CLI, minimatch for patterns
- **Git**: Uses spawnSync for git operations
- **GitHub CLI**: Optional, used for PR creation

### Code Patterns
- Check external tool availability before use
- Use spawnSync with proper error handling
- Return structured result objects from operations
- Handle file system operations with existence checks

## Working with This Codebase

1. Always check tool dependencies (git, gh) before operations
2. Use the GitResult interface for git command outcomes
3. Follow the established directory structure for new features
4. Use ES module import syntax with .js extensions
5. Implement proper error handling with process.exit codes
6. Test CLI changes with `npm run build` first