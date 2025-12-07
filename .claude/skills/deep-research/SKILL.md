---
name: deep-research
description: Use when gathering information from the web, finding best practices, or learning new patterns. Guides effective research using claude-envoy tools.
---

# Deep Research

Playbook for conducting quality research using claude-envoy.

## Quick Reference

**Tools via claude-envoy CLI:**

```bash
# Deep research with citations (Perplexity)
.claude/envoy/envoy perplexity research "query"

# Web search with sources (Tavily)
.claude/envoy/envoy tavily search "query" --max-results 10

# Extract full content from URLs (Tavily)
.claude/envoy/envoy tavily extract "url1" "url2" --depth advanced
```

## When to Use What

| Need | Tool |
|------|------|
| Pre-synthesized findings with citations | `perplexity research` |
| Find sources, get URLs | `tavily search` |
| Extract full page content | `tavily extract` |
| Agentic workflow (search then deep-dive) | Tavily search → extract |

## Research Workflow

### 1. Scope the Query
Before calling any tool, clarify:
- What specifically needs to be learned?
- What will the findings be used for?
- What level of depth is needed?

### 2. Choose Approach

**Option A: Pre-synthesized (faster)**
```bash
.claude/envoy/envoy perplexity research "[topic] best practices 2025"
```
Returns synthesized findings with citations. Good for broad questions.

**Option B: Agentic (more control)**
```bash
# Find sources
.claude/envoy/envoy tavily search "[topic]" --max-results 10 --include-answer

# Extract full content from promising URLs
.claude/envoy/envoy tavily extract "url1" "url2" --depth advanced
```
Returns raw content for you to process. Good when you need specific details.

### 3. Process Results

All tools return JSON. Parse `data.content` or `data.results` for findings.

## Query Tips

**For best practices:**
```
"[topic] best practices 2025"
```

**For implementation:**
```
"how to implement [specific thing] in [context]"
```

**For comparison:**
```
"[option A] vs [option B] for [use case]"
```

## Output Format

After research, return to parent agent:

```markdown
## Research: [Topic]

### Key Findings
- Finding with context
- Finding with context

### Sources
- [Source URL] - what was relevant

### Recommendations
What to do based on findings.
```
