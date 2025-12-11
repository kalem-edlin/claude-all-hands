---
name: repomix-extraction
description: Directory extraction using repomix. Use for ANY directory exploration or multi-file read - always more efficient than individual Read calls.
---

<objective>
Pack directory contents into AI-friendly format for comprehensive pattern analysis. ALWAYS prefer over individual Read calls when exploring directories or reading multiple files.
</objective>

<quick_start>
```bash
# Pack directory to stdout (NO FILES CREATED)
npx repomix@latest --stdout path/to/directory

# Include specific patterns
npx repomix@latest --stdout --include "**/*.ts,**/*.md" path/to/directory

# Compress for large directories
npx repomix@latest --stdout --compress path/to/directory
```
</quick_start>

<success_criteria>
- Output streams to stdout (no file created)
- All relevant files included in single output
- Patterns identified from combined content
</success_criteria>

<constraints>
- NEVER use repomix without `--stdout` (creates files in project root)
- Always stream to stdout, never create output files
</constraints>

<workflow>
### 1. Pack Directory to Stdout
```bash
npx repomix@latest --stdout path/to/directory
```

### 2. Analyze Output
From stdout output, identify:
- File structure conventions
- Directory organization patterns
- Naming conventions
- Code style/idioms
- Import/export patterns

### 3. Synthesize Patterns
Extract actionable patterns:
- Recurring code patterns
- Domain-specific conventions
- Anti-patterns to avoid
- Guidelines for implementation
</workflow>

<examples>
### Options Reference

| Flag | Use |
|------|-----|
| `--stdout` | REQUIRED - Output to stdout, no file |
| `--include "glob"` | Include specific file patterns |
| `--ignore "glob"` | Exclude patterns |
| `--compress` | Tree-sitter extraction (large dirs) |

### Output Format
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
</examples>

<anti_patterns>
- Using individual Read calls when exploring directories
- Running repomix without `--stdout` flag
- Creating output files in project root
- Reading files one by one when batch extraction available
</anti_patterns>
