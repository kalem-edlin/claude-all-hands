---
name: repomix-extraction
description: Directory extraction using repomix. Use for ANY directory exploration or multi-file read - always more efficient than individual Read calls.
---

<objective>
Pack directory contents into AI-friendly format for comprehensive pattern analysis. ALWAYS prefer over individual Read calls when exploring directories or reading multiple files.
</objective>

<quick_start>
```bash
# 1. Discovery: Identify relevant paths
rg --files src/auth | head -20
tree -L 2 src/

# 2. Plan: Estimate tokens (no code returned)
.claude/envoy/envoy repomix estimate src/auth src/api/routes

# 3. Extract: Get code (after confirming budget)
.claude/envoy/envoy repomix extract src/auth src/api/routes
```
</quick_start>

<workflow>
### Phase 1: Discovery
Use lightweight tools to identify relevant files/directories:

```bash
# Find files by pattern
rg --files --glob "*.ts" src/

# Show directory structure
tree -L 2 src/

# Find files containing keyword
rg -l "authentication" src/

# Grep for patterns
grep -r "class.*Service" src/ --include="*.ts" -l
```

**Goal**: Build a list of paths that contain the code you need for implementation context.

### Phase 2: Plan Extraction
Estimate token usage BEFORE extracting code:

```bash
# Single path
.claude/envoy/envoy repomix estimate src/auth

# Multiple paths (aggregated)
.claude/envoy/envoy repomix estimate src/auth src/api/routes src/middleware
```

**Returns**: Total token count only (no code content).

**Decision point**: Based on task complexity and estimated tokens, decide:
- If estimate is reasonable → proceed to extraction
- If estimate is too high → narrow scope with more specific paths
- If estimate is very low → consider expanding scope

### Phase 3: Extract Code
After confirming budget, extract code content:

```bash
# Single or multiple paths
.claude/envoy/envoy repomix extract src/auth src/api/routes
```

**Returns**: Combined code content from all paths.

### Analyze Output
From extracted content, identify:
- File structure conventions
- Directory organization patterns
- Naming conventions
- Code style/idioms
- Import/export patterns
</workflow>

<success_criteria>
- Discovery phase identifies optimal extraction scope
- Token estimate confirms budget before extraction
- All relevant files included in single extraction
- Patterns identified from combined content
</success_criteria>

<constraints>
- **50k token budget** - max total extraction per session, track cumulative usage
- **Estimate before extract** - use `estimate` to plan optimal path combinations under budget
- **Multi-path support** - aggregate paths in single command
- **No temp files** - envoy uses `--stdout` internally
</constraints>

<envoy_commands>
| Command | Purpose |
|---------|---------|
| `envoy repomix estimate <path...>` | Get aggregated token count (no code returned) |
| `envoy repomix extract <path...>` | Get combined code content (for implementation) |

**Multi-path example**:
```bash
# Estimate tokens for auth module + related routes
.claude/envoy/envoy repomix estimate src/auth src/api/auth src/middleware/auth

# Returns: {"token_count": 8500, "paths": [...]}

# If reasonable, extract all
.claude/envoy/envoy repomix extract src/auth src/api/auth src/middleware/auth

# Returns: {"token_count": 8500, "content": "...all code..."}
```
</envoy_commands>

<examples>
### Example: Planning Implementation Context

**Task**: Implement refresh token rotation

```bash
# 1. Discovery - find auth-related files
rg -l "token|refresh|jwt" src/ --type ts

# 2. Plan - estimate paths
.claude/envoy/envoy repomix estimate src/auth src/api/auth

# Output: {"token_count": 5200, ...}
# Decision: 5200 tokens reasonable for this task

# 3. Extract
.claude/envoy/envoy repomix extract src/auth src/api/auth
```

### Output Format
```markdown
## Directory Analysis: src/auth, src/api/auth

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
- Extracting without estimating first
- Using individual Read calls when batch extraction available
- Running raw `npx repomix` instead of envoy commands
- Extracting entire codebase when only specific modules needed
- Not using discovery phase to narrow scope
</anti_patterns>
