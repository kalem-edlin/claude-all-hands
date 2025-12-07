# claude-envoy Implementation Plan

## Overview

Modular CLI tool replacing MCP servers for agent-scoped external tool access. Lives in `.claude/envoy/`, invoked via Bash from skills.

## Architecture

```
.claude/envoy/
├── envoy                     # Bash wrapper (entry point)
├── envoy.py                  # Core CLI (argparse)
├── commands/                 # Command implementations
│   ├── __init__.py
│   ├── base.py               # BaseCommand class + output schemas
│   ├── perplexity.py         # research (thin wrapper)
│   ├── tavily.py             # search, extract (agentic workflow support)
│   └── vertex.py             # ask, validate, review, architect
├── snippets/                 # LLM-readable tool specs (input/output schemas)
│   ├── _template.md
│   ├── perplexity-research.md
│   ├── tavily-search.md
│   ├── tavily-extract.md
│   ├── vertex-ask.md
│   ├── vertex-validate.md
│   ├── vertex-review.md
│   └── vertex-architect.md
├── prompts/                  # System prompts for opinionated Gemini tools
│   ├── validate.txt          # Plan validator role
│   ├── review.txt            # Implementation reviewer role
│   └── architect.txt         # Solutions architect role
├── README.md                 # Tool descriptions, use cases
└── requirements.txt
```

## Core Components

### 1. Bash Wrapper (`envoy`)

```bash
#!/bin/bash
export PERPLEXITY_API_KEY="${PERPLEXITY_API_KEY:-}"
export VERTEX_API_KEY="${VERTEX_API_KEY:-}"
exec "$HOME/.claude/envoy/venv/bin/python" "$HOME/.claude/envoy/envoy.py" "$@"
```

Installed to PATH or invoked via `~/.claude/envoy/envoy`.

### 2. CLI Structure (`envoy.py`)

Argparse with subparsers:

```
envoy <command> <subcommand> [options]
```

Commands:
- `envoy perplexity research "query"` - Deep research with citations (sonar-deep-research)
- `envoy tavily search "query"` - Web search with optional LLM answer (agentic workflow)
- `envoy tavily extract <urls>` - Extract content from URLs (basic/advanced depth)
- `envoy vertex ask "query"` - Raw Gemini inference (thin wrapper)
- `envoy vertex validate --plan <file>` - Validate plan against user requirements
- `envoy vertex review --plan <file>` - Review implementation against plan
- `envoy vertex architect "query"` - Solutions architecture guidance
- `envoy info` - Show available commands and API status

### 3. Command Module Pattern (`commands/base.py`)

```python
class BaseCommand:
    """Base for all commands. Enforces output schema."""
    name: str
    description: str
    input_schema: dict   # For docs generation
    output_schema: dict  # For response validation

    def execute(self, **kwargs) -> dict:
        raise NotImplementedError

    def format_output(self, result: dict) -> str:
        """Standard JSON output for piping"""
        return json.dumps(result, indent=2)
```

### 4. Piping Support

All commands output JSON to stdout:

```bash
# Chaining
envoy perplexity search "topic" | envoy vertex ask --stdin "analyze these results"

# Or use jq
envoy perplexity research "topic" | jq '.citations'
```

`--stdin` flag reads piped input and injects into prompt.

### 5. Output Schema (defined in base.py)

```python
STANDARD_RESPONSE = {
    "status": "success" | "error",
    "data": {
        "content": str,
        "citations": list[str] | None,
        "thinking": str | None  # if not stripped
    },
    "metadata": {
        "model": str,
        "command": str,
        "duration_ms": int
    }
}
```

## Vertex Tools (Gemini-Powered)

### Philosophy: Context Window Preservation

These tools read files directly in the CLI and pass to Gemini, keeping content OUT of Claude's context window. Claude only receives structured output/recommendations.

### 1. `vertex ask` - Raw Inference (Thin Wrapper)

No system prompt. Direct Gemini call for arbitrary queries.

```bash
envoy vertex ask "query" [--model <model>] [--files <paths>]
```

**Use case:** When skill files need to provide their own system context to Gemini.

### 2. `vertex validate` - Plan Validator

**Problem:** Plan tool pollutes main agent context with discovery/research.

**Solution:** Validate plan externally. Plan file + user queries stay out of Claude context.

```bash
envoy vertex validate --plan .claude/plans/feature.md [--queries <file>]
```

**Inputs:**
- `--plan` - Plan file path (read by CLI, not Claude)
- `--queries` - Optional file with user queries/amendments in order
- `--project-root` - For file access if plan references code

**System prompt (prompts/validate.txt):**
```
You are a plan validator ensuring implementations are NOT over-engineered.

Given:
1. User's original queries/requirements (in chronological order)
2. The proposed plan

Evaluate:
- Does plan exceed what user actually asked for?
- Are there unnecessary abstractions/features?
- Is complexity justified by requirements?

Output JSON:
{
  "verdict": "approved" | "needs_simplification" | "needs_clarification",
  "issues": [{"section": str, "problem": str, "suggestion": str}],
  "questions_for_user": [str],  // If requirements unclear
  "recommended_edits": [{"section": str, "current": str, "proposed": str}]
}
```

**Output:** Structured recommendations. Claude uses AskUserQuestion if `questions_for_user` non-empty.

### 3. `vertex review` - Implementation Reviewer

**Problem:** Code review pollutes context with diffs.

**Solution:** CLI runs `git diff`, passes to Gemini with plan. Claude gets structured feedback only.

```bash
envoy vertex review --plan .claude/plans/feature.md [--step <n>] [--diff-against <ref>]
```

**Inputs:**
- `--plan` - Plan file path
- `--step` - Optional: specific step being reviewed (for incremental reviews)
- `--diff-against` - Git ref for diff (default: main)
- CLI auto-runs `git diff` internally

**System prompt (prompts/review.txt):**
```
You are an implementation reviewer.

Given:
1. The plan (with steps)
2. Git diff of changes
3. Optional: which step is being reviewed

Evaluate:
- Does implementation match plan intent?
- Are there deviations that need addressing?
- Code quality issues?

Output JSON:
{
  "step_reviewed": int | null,
  "verdict": "approved" | "needs_work" | "off_track",
  "plan_adherence": {"on_track": bool, "deviations": [str]},
  "issues": [{"file": str, "line": int, "severity": str, "issue": str, "suggestion": str}],
  "approved_steps": [int],  // Steps that pass review
  "questions_for_user": [str]
}
```

**When called:** After each plan step, or at end of implementation. Skill/agent decides cadence.

### 4. `vertex architect` - Solutions Architect

**Problem:** Large features need architectural guidance before planning.

**Solution:** Gemini as solutions architect (Oracle's core value prop).

```bash
envoy vertex architect "feature description" [--files <paths>] [--constraints <text>]
```

**Inputs:**
- Query describing the feature/system
- `--files` - Relevant existing code for context
- `--constraints` - Known constraints (tech stack, perf requirements, etc.)

**System prompt (prompts/architect.txt):**
```
You are a solutions architect for complex software systems.

Given a feature request and optional codebase context:

1. Identify architectural decisions needed
2. Propose approaches with trade-offs
3. Recommend implementation strategy
4. Flag risks and unknowns

Output JSON:
{
  "complexity_assessment": "simple" | "moderate" | "complex" | "system_integration",
  "architectural_decisions": [{
    "decision": str,
    "options": [{"option": str, "pros": [str], "cons": [str]}],
    "recommendation": str,
    "rationale": str
  }],
  "implementation_strategy": {
    "approach": str,
    "phases": [{"phase": str, "deliverables": [str]}],
    "dependencies": [str]
  },
  "risks": [{"risk": str, "mitigation": str, "severity": "low"|"medium"|"high"}],
  "questions_for_user": [str]  // Clarifications needed before planning
}
```

**Use case:** Before entering plan mode for big features. Curator/planning agent calls this first.

## Tavily Tools (Search & Extract)

Alternative to Perplexity for research. Designed for agentic workflows with search → extract pattern.

### 1. `tavily search` - Web Search

```bash
envoy tavily search "query" [options]
```

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--depth` | basic/advanced | basic | Search depth (advanced = 2 credits) |
| `--max-results` | int (1-20) | 5 | Number of results |
| `--include-answer` | flag/basic/advanced | false | Include LLM-generated answer |
| `--include-raw` | flag | false | Include raw page content |
| `--topic` | general/news/finance | general | Search category |
| `--time-range` | day/week/month/year | - | Filter by recency |
| `--include-domains` | string[] | - | Whitelist domains |
| `--exclude-domains` | string[] | - | Exclude domains |

**Output Schema:**
```json
{
  "status": "success",
  "data": {
    "query": "string",
    "answer": "string | null",
    "results": [
      {
        "title": "string",
        "url": "string",
        "content": "string (snippet)",
        "score": 0.95,
        "raw_content": "string | null"
      }
    ]
  },
  "metadata": {
    "response_time": 1.23,
    "result_count": 5
  }
}
```

**Agentic Workflow:** Search returns URLs in `results[].url`. Pass these to `tavily extract` for full content.

### 2. `tavily extract` - Content Extraction

```bash
envoy tavily extract <urls> [options]
```

**Arguments:**
- `urls` - Space-separated URLs or comma-separated (max 20)

**Options:**
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--depth` | basic/advanced | basic | Extraction depth (advanced gets tables, embedded content) |
| `--format` | markdown/text | markdown | Output format |
| `--include-images` | flag | false | Include extracted images |
| `--timeout` | float (1-60) | 10/30 | Timeout in seconds (default varies by depth) |

**Output Schema:**
```json
{
  "status": "success",
  "data": {
    "results": [
      {
        "url": "string",
        "raw_content": "string (full page content)",
        "images": ["url1", "url2"]
      }
    ],
    "failed_results": [
      {"url": "string", "error": "string"}
    ]
  },
  "metadata": {
    "response_time": 2.5,
    "success_count": 3,
    "failed_count": 1
  }
}
```

### Agentic Workflow Pattern

```bash
# Step 1: Search for sources
envoy tavily search "Claude Code best practices 2025" --max-results 10

# Step 2: Extract full content from top results
envoy tavily extract "https://docs.anthropic.com/..." "https://..." --depth advanced

# Agent consolidates extracted content into findings
```

**Why both Tavily and Perplexity?**
- **Perplexity research:** Single call, deep research with citations, pre-synthesized
- **Tavily search + extract:** Two-step, more control, raw content for agent to process

Choose based on workflow needs. Tavily better for when agent needs raw content to process itself.

## Snippets (`snippets/`)

LLM-readable tool specs. Each file = one tool. Contains input/output schemas only.

### Example: `snippets/perplexity-research.md`

```markdown
# perplexity-research

## Input

```bash
envoy perplexity research <query> [--strip-thinking] [--context <text>]
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| query | string | Yes | Research question |
| --strip-thinking | flag | No | Remove <think> blocks |
| --context | string | No | Additional context for query |
| --stdin | flag | No | Read context from stdin (for piping) |

## Output

```json
{
  "status": "success",
  "data": {
    "content": "string - research findings",
    "citations": ["url1", "url2"]
  },
  "metadata": {
    "model": "sonar-deep-research",
    "command": "perplexity research",
    "duration_ms": 1234
  }
}
```
```

### Template: `snippets/_template.md`

```markdown
# {command-name}

## Input

```bash
envoy {group} {command} <required-arg> [--optional-flag]
```

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| | | | |

## Output

```json
{
  "status": "success|error",
  "data": {},
  "metadata": {}
}
```
```

## README.md (Tool Catalog)

Centralized tool descriptions and use cases for Curator:

```markdown
# claude-envoy

CLI for agent-scoped external tool access. Keeps file contents OUT of Claude's context.

## Tools

### Research

| Tool | Use Case |
|------|----------|
| `perplexity research` | Deep research with citations (pre-synthesized) |
| `tavily search` | Web search with optional LLM answer |
| `tavily extract` | Extract full content from URLs |

### Vertex (Gemini)

| Tool | Use Case |
|------|----------|
| `vertex ask` | Raw Gemini inference (thin wrapper, no system prompt) |
| `vertex validate` | Validate plan against user requirements (anti-overengineering) |
| `vertex review` | Review implementation against plan (uses git diff internally) |
| `vertex architect` | Solutions architecture for complex features |

## When to Use What

**Research:**
- **Pre-synthesized findings** → `perplexity research`
- **Raw sources for agent processing** → `tavily search` → `tavily extract`
- **Agentic workflow (search then extract)** → Tavily

**Vertex:**
- **Arbitrary Gemini query** → `vertex ask`
- **Before plan approval** → `vertex validate`
- **After implementation steps** → `vertex review`
- **Big feature scoping** → `vertex architect`

## Context Window Benefits

These tools read files directly and pass to external LLMs. Claude only receives structured JSON output, not raw file contents or diffs.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PERPLEXITY_API_KEY` | For perplexity | Perplexity API key |
| `TAVILY_API_KEY` | For tavily | Tavily API key |
| `VERTEX_API_KEY` | For vertex | Google Vertex AI key |
| `ENVOY_TIMEOUT_MS` | No | Global timeout (default: 120000) |

## Adding Tools

See `snippets/_template.md` for schema format.
See `prompts/` for system prompt patterns.
```

## Planning Workflow (Context-Preserving)

### Problem
Claude's Plan tool does discovery/research in main agent context, polluting it before implementation even starts.

### Solution: Subagent-Driven Planning

```
User Request
    ↓
Main Agent (coordinator)
    ↓ delegates to
Planning Subagent → writes to .claude/plans/feature.md
    ↓ may call
Research Subagent → envoy perplexity research → findings back to Planning
    ↓ may call
Architect Subagent → envoy vertex architect → architecture back to Planning
    ↓ iterates on plan file
Planning Subagent → envoy vertex validate → validation feedback
    ↓ when ready
Main Agent reads plan file, presents to user
    ↓ user approves
Main Agent enters Plan mode with clean context + plan
```

### Key Principles

1. **Plan lives in file:** `.claude/plans/feature.md` - subagents write to it, main agent only reads final version
2. **Research stays in subagents:** Perplexity responses consolidated by researcher, only summary returns to parent
3. **Validation external:** `vertex validate` reads plan + queries, returns structured feedback (not plan content)
4. **Main agent stays clean:** Only coordinates, doesn't hold intermediate research/planning content

### File-Based Plan Iteration

```markdown
<!-- .claude/plans/feature.md -->
# Feature: User Authentication

## Status: draft | validating | approved

## User Requirements
- [from queries file or inline]

## Architecture Decisions
- [from vertex architect output]

## Implementation Steps
1. [ ] Step one
2. [ ] Step two

## Validation
- Last validated: [timestamp]
- Verdict: [from vertex validate]
- Open questions: [if any]
```

Subagents update sections. Main agent reads when Status = approved.

## Skills Integration

### 1. claude-envoy-usage Skill

Master skill for Curator agent - how to use envoy when building skills:

```markdown
---
name: claude-envoy-usage
description: Use when building skills that need external tool access. Documents all claude-envoy commands, patterns, and how to integrate them into skill files.
---

# claude-envoy Usage Guide

For Curator agent when building skills with external tool access.

## Philosophy

claude-envoy replaces MCP servers for agent-scoped tool access. Skills invoke envoy via Bash commands. This enables:
- Agent-scoped tool access (skills control which commands agents see)
- Modular external APIs without global MCP pollution
- Piping/chaining for complex workflows

## Available Commands

### Perplexity (Research)
- `perplexity ask` - Quick Q&A
- `perplexity research` - Deep research with citations
- `perplexity reason` - Complex reasoning
- `perplexity search` - Web search

### Vertex (Inference)
- `vertex ask` - Gemini architectural advice

## Building Skills with envoy

### Pattern 1: Single Command

```markdown
## Research Workflow

Use envoy for external research:

\`\`\`bash
envoy perplexity research "your query"
\`\`\`

Parse the JSON response for findings.
```

### Pattern 2: Chained Commands

```markdown
## Deep Analysis Workflow

1. Search for sources:
\`\`\`bash
envoy perplexity search "topic"
\`\`\`

2. Pipe to reasoning:
\`\`\`bash
envoy perplexity search "topic" | envoy perplexity reason --stdin "analyze"
\`\`\`
```

### Pattern 3: Progressive Disclosure

Skills should mention envoy commands in Quick Reference, with detailed invocation in workflow sections.

## Command Schemas

For input/output schemas, reference `.claude/envoy/snippets/{tool}.md`
For tool descriptions and use cases, reference `.claude/envoy/README.md`
```

### 2. claude-envoy-curation Skill

For Curator to extend envoy itself:

```markdown
---
name: claude-envoy-curation
description: Use when adding new commands to claude-envoy. Contains command implementation patterns, schema standards, and doc generation requirements.
---

# claude-envoy Curation

For extending claude-envoy with new commands.

## Adding a Command

### 1. Create Command Module

In `.claude/envoy/commands/{group}.py`:

```python
from .base import BaseCommand

class MyCommand(BaseCommand):
    name = "mycommand"
    description = "What it does"
    input_schema = {"query": {"type": "string", "required": True}}
    output_schema = STANDARD_RESPONSE

    def execute(self, query: str, **kwargs) -> dict:
        # Implementation
        return {"status": "success", "data": {...}}
```

### 2. Register in envoy.py

Add subparser in `create_parser()`.

### 3. Create Snippet

Use `.claude/envoy/snippets/_template.md` to create `snippets/{group}-{command}.md`

### 4. Update README.md

Add tool to appropriate section with use case description.

## Standards

- All commands output JSON
- All commands support --stdin for piping
- All commands have snippets (input/output schema)
- README.md documents use cases
```

## Installation

### install.sh

```bash
#!/bin/bash
ENVOY_DIR="$HOME/.claude/envoy"
mkdir -p "$ENVOY_DIR"

# Copy files
cp -r . "$ENVOY_DIR/"

# Create venv
python3 -m venv "$ENVOY_DIR/venv"
"$ENVOY_DIR/venv/bin/pip" install -r "$ENVOY_DIR/requirements.txt"

# Make executable
chmod +x "$ENVOY_DIR/envoy"

echo "claude-envoy installed. Add to PATH or invoke via ~/.claude/envoy/envoy"
```

### requirements.txt

```
requests>=2.28.0
google-genai>=0.8.0
google-auth-oauthlib>=1.0.0
pydantic>=2.0.0
```

## Progressive Disclosure Layers

1. **Skill Metadata** (~200 chars) - Skill description mentions envoy capability
2. **Skill Body** (1-10KB) - Quick reference shows commands, workflow sections show usage
3. **envoy README.md** - Tool catalog with use cases (when Curator needs overview)
4. **envoy snippets/** - Input/output schemas (when building specific invocations)
5. **External docs** - API provider documentation via WebFetch

## Curator Workflow

When Curator builds a skill needing external tools:

1. Read `.claude/envoy/README.md` for tool catalog and use cases
2. Read relevant `snippets/{tool}.md` for input/output schemas
3. Include commands in skill's Quick Reference
4. Show detailed invocation in workflow sections

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] `envoy` bash wrapper (project-scoped venv)
- [ ] `envoy.py` CLI with argparse
- [ ] `commands/base.py` BaseCommand pattern + error schema
- [ ] `snippets/_template.md`
- [ ] `README.md` (tool catalog skeleton)
- [ ] Startup hook for venv creation
- [ ] Add `.claude/plans/` to `.gitignore`

### Phase 2: Husky + Plan Lifecycle
- [ ] Install Husky (`npm install husky --save-dev && npx husky init`)
- [ ] `.husky/claude/common.sh` - shared utilities
- [ ] `.husky/claude/cleanup-plan.sh` - cleanup merged branch plans
- [ ] `.husky/post-merge` - trigger cleanup
- [ ] `.claude/hooks/capture-queries.py` - UserPromptSubmit hook
- [ ] Update `.claude/settings.json` with UserPromptSubmit hook
- [ ] `envoy plans cleanup` command - manual orphan cleanup

### Phase 3: Research Tools (Perplexity + Tavily)
- [ ] `commands/perplexity.py` - research (thin wrapper)
- [ ] `commands/tavily.py` - search + extract (agentic workflow)
- [ ] Snippets: `perplexity-research.md`, `tavily-search.md`, `tavily-extract.md`
- [ ] Update README.md

### Phase 4: Vertex Tools
- [ ] `commands/vertex.py`
  - [ ] ask (thin wrapper, no system prompt)
  - [ ] validate (plan validator - reads plan dir, sends to Gemini)
  - [ ] review (implementation reviewer - runs git diff internally)
  - [ ] architect (solutions architect with system prompt)
- [ ] `prompts/` directory with system prompts
- [ ] Snippets: vertex-ask, vertex-validate, vertex-review, vertex-architect
- [ ] Update README.md

### Phase 5: Skills & CLAUDE.md Integration
- [ ] `claude-envoy-usage` skill (Curator reference)
- [ ] `claude-envoy-curation` skill (extending envoy)
- [ ] Update `deep-research` skill to use envoy
- [ ] Add error handling directive to CLAUDE.md
- [ ] Planning agent/skill for context-preserving workflow

### Phase 6: Polish
- [ ] `envoy info` command
- [ ] requirements.txt
- [ ] package.json (for Husky)
- [ ] Document piping pattern for future

## CLAUDE.md Additions

Add to project CLAUDE.md:

```markdown
## claude-envoy Errors

When any `envoy` command fails:
1. Use AskUserQuestion: "[Tool] failed: [error]. Options: (A) Retry, (B) [inferred alternative], (C) Skip step"
2. In auto-accept mode: Infer best alternative and proceed

## Planning Workflow

For complex features:
1. Delegate planning to Planning subagent (writes to `.claude/plans/`)
2. Main agent only reads final approved plan
3. Use `envoy vertex validate` before presenting plan to user
4. Use `envoy vertex review` after implementation steps
```

## Resolved Questions

1. **Project-scoped vs global install?** → Project-scoped. venv lives in `.claude/envoy/venv/`, created by startup hook. Supports template/plugin model where each project gets isolated envoy.

2. **Auth cascade priority?** → Env vars only. No OAuth complexity. `PERPLEXITY_API_KEY`, `VERTEX_API_KEY`.

3. **History/memory feature?** → **Deferred.** Oracle's history adds tokens (doesn't save them). Not aligned with context-reduction goals. Each envoy call is stateless.

4. **Timeout config?** → `ENVOY_TIMEOUT_MS` env var, default 120000. Documented in README, not required.

5. **Piping?** → **Deferred.** Document future pattern in README for context-window savings. Start with standalone commands.

6. **Error handling?** → Standardized JSON error format. CLAUDE.md directive for global fallback behavior (AskUserQuestion or inferred alternative).

7. **Does Gemini have codebase access?** → No. Files must be explicitly passed via `--files`. CLI reads files, passes to Gemini. Claude never holds file content for envoy calls.

8. **Planning context pollution?** → Solved via subagent-driven planning. Plan lives in file, subagents iterate on it, main agent only reads final approved version.

## Design Decisions

### Thin vs Opinionated Commands

| Command | Type | Rationale |
|---------|------|-----------|
| `vertex ask` | Thin | Let skills provide context |
| `vertex validate` | Opinionated | Needs consistent anti-overengineering behavior |
| `vertex review` | Opinionated | Needs consistent review criteria |
| `vertex architect` | Opinionated | Needs consistent architecture output format |
| `perplexity research` | Thin | Just wraps API |

### Why only `perplexity research` initially
- `perplexity_ask` → Claude has WebSearch for quick lookups
- `perplexity_search` → Claude has WebSearch
- `perplexity_reason` → Add later if synthesis needs arise
- `perplexity_research` → Unique value: deep research with citations

### Context Window Preservation Strategy

1. **Files read by CLI, not Claude:** `--files` args read in Python, sent to external LLM
2. **Git diff in CLI:** `vertex review` runs `git diff` internally
3. **Plan in file:** Subagents write to `.claude/plans/`, main agent reads once
4. **Structured output only:** Claude receives JSON recommendations, not raw content

## Plan Lifecycle: Branch-Scoped with Husky

### Structure (gitignored)

```
.claude/plans/                    # gitignored
├── feat-auth/                    # Directory per branch (sanitized name)
│   ├── plan.md                   # The plan
│   ├── queries.jsonl             # User prompts captured by hook
│   └── files.jsonl               # File paths referenced in queries
├── feat-billing/
│   └── ...
└── main/                         # Fallback for main branch work
```

### Why Branch-Scoped
- Natural lifecycle: branch create → work → merge → cleanup
- Handles branch switching: each branch's data persists locally
- Git already tracks branch lifecycle
- Cleanup on branch delete via Husky hook

### Husky Integration

```
.husky/
├── _/                            # Husky internals
├── post-checkout                 # Detect branch switches (optional logging)
├── post-merge                    # Cleanup merged branch plan dirs
└── claude/                       # Modular claude-agents hooks
    ├── cleanup-plan.sh           # Remove plan dir for deleted branch
    └── common.sh                 # Shared utilities
```

**`.husky/post-merge`** (runs after merge completes):
```bash
#!/bin/sh
. "$(dirname "$0")/claude/cleanup-plan.sh"
```

**`.husky/claude/cleanup-plan.sh`**:
```bash
#!/bin/sh
# Get merged branch from reflog (branch that was just merged)
merged_branch=$(git reflog -1 | grep -oP 'merge \K[^:]+' || echo "")

if [ -n "$merged_branch" ]; then
    plan_dir=".claude/plans/$(echo "$merged_branch" | sed 's/[^a-zA-Z0-9_-]/-/g')"
    if [ -d "$plan_dir" ]; then
        rm -rf "$plan_dir"
        echo "Cleaned up plan directory: $plan_dir"
    fi
fi
```

**`.husky/claude/common.sh`**:
```bash
#!/bin/sh
# Sanitize branch name for plan directory
sanitize_branch() {
    echo "$1" | sed 's/[^a-zA-Z0-9_-]/-/g'
}

# Get current plan directory
get_plan_dir() {
    branch=$(git branch --show-current 2>/dev/null || echo "detached")
    echo ".claude/plans/$(sanitize_branch "$branch")"
}
```

### Claude Hook: UserPromptSubmit

**`.claude/hooks/capture-queries.py`**:
```python
#!/usr/bin/env python3
import json, sys, os, re
from pathlib import Path

input_data = json.load(sys.stdin)
prompt = input_data.get("prompt", "")
cwd = input_data.get("cwd", ".")

# Get current branch
branch = os.popen("git branch --show-current 2>/dev/null").read().strip() or "main"
plan_id = re.sub(r'[^a-zA-Z0-9_-]', '-', branch)

# Plan directory
plans_dir = Path(cwd) / ".claude" / "plans" / plan_id
plans_dir.mkdir(parents=True, exist_ok=True)

# Append query
with open(plans_dir / "queries.jsonl", "a") as f:
    f.write(json.dumps({"prompt": prompt}) + "\n")

# Extract file references
file_patterns = re.findall(r'[\w./\-]+\.\w+', prompt)
if file_patterns:
    with open(plans_dir / "files.jsonl", "a") as f:
        for fp in file_patterns:
            if os.path.exists(os.path.join(cwd, fp)):
                f.write(json.dumps({"path": fp}) + "\n")

sys.exit(0)
```

### Manual Cleanup Command

**`envoy plans cleanup`** - removes orphaned plan dirs (branches that no longer exist):
```bash
envoy plans cleanup  # Scans .claude/plans/, removes dirs for non-existent branches
```

### `vertex validate` Auto-Detection

```bash
# Auto-detects current branch, finds its plan dir
envoy vertex validate

# Explicit path
envoy vertex validate --plan .claude/plans/feat-auth/
```

CLI reads queries.jsonl + files.jsonl, loads referenced files, sends to Gemini. **Claude never sees this content.**

### Lifecycle Summary

| Event | Action |
|-------|--------|
| User prompt | `UserPromptSubmit` hook → append to `plans/{branch}/queries.jsonl` |
| Branch switch | Nothing (each branch has own dir) |
| Branch merge | Husky `post-merge` → cleanup merged branch's plan dir |
| Manual cleanup | `envoy plans cleanup` → remove orphaned dirs |
| Validate | `envoy vertex validate` → read plan dir, send to Gemini |

## Closed Questions

1. ~~**User query history access?**~~ → `UserPromptSubmit` hook writes to branch-scoped `queries.jsonl`

2. **Review cadence?** → Left to skill/agent discretion

3. ~~**Plan file locking?**~~ → Not a concern; edit conflicts handled by normal retry
