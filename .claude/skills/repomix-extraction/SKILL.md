---
name: repomix-extraction
description: Directory extraction using repomix for pattern discovery. Use when skills/directives fall short and you need to understand codebase patterns in a specific directory.
---

# Repomix Extraction

Pack directory contents into AI-friendly format for comprehensive pattern analysis.

## When to Use

- Skills/directives don't cover the directory you need to understand
- Need to discover patterns in unfamiliar codebase areas
- Creating specialist agents that need repo pattern knowledge
- Analyzing code structure before making changes

## Quick Reference

```bash
# Pack directory (outputs repomix-output.xml)
npx repomix@latest path/to/directory

# Include specific patterns
npx repomix@latest --include "**/*.ts,**/*.md" path/to/directory

# Exclude noise
npx repomix@latest --ignore "**/*.log,node_modules/" path/to/directory

# Compress for large directories (tree-sitter extraction)
npx repomix@latest --compress path/to/directory

# Output to stdout (for piping)
npx repomix@latest --stdout path/to/directory
```

## Extraction Process

### 1. Pack Directory
```bash
npx repomix@latest path/to/directory
```
Output: `repomix-output.xml` in current directory

### 2. Read Output
Read the XML file to analyze:
- File structure conventions
- Directory organization patterns
- Naming conventions (files, functions, variables)
- Code style/idioms
- Import/export patterns
- Error handling approaches

### 3. Synthesize Patterns
Extract actionable patterns:
- Recurring code patterns
- Domain-specific conventions
- Anti-patterns to avoid
- Guidelines for system prompts or implementation

## Options Reference

| Flag | Use |
|------|-----|
| `--include "glob"` | Include specific file patterns |
| `--ignore "glob"` | Exclude patterns |
| `--compress` | Tree-sitter extraction (large dirs) |
| `--stdout` | Output to stdout instead of file |
| `--remote URL` | Pack remote repo (GitHub shorthand) |

## Output Format

Return extracted patterns as:
```markdown
## Directory Analysis: [path]

### Structure
- [directory organization patterns]

### Conventions
- Naming: [patterns]
- Style: [patterns]

### Key Patterns
- [pattern 1]
- [pattern 2]

### Recommendations
[Actionable guidance based on patterns]
```
