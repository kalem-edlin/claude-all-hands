---
name: research-tools
description: Use when need to "search the web", "research [topic]", "extract URL content", or "find sources". Provides web search (Tavily), deep research (Perplexity), and X/Twitter insights (Grok). Only for curator/researcher agents.
---

<objective>
External research capability for curator and researcher agents. Provides web search, deep research with citations, and real-time social signals via envoy commands.
</objective>

<quick_start>
```bash
# Deep research (Perplexity)
envoy perplexity research "query"

# Web search (Tavily)
envoy tavily search "query"

# Extract URL content
envoy tavily extract "url1" "url2"
```
</quick_start>

<success_criteria>
- JSON response with `status: success` and `data` containing findings
- Sources/citations included for synthesis queries
- Content extracted for known URLs
</success_criteria>

<constraints>
- Only curator/researcher agents may use these tools
- GitHub content: use `gh` CLI instead of extract
- All commands return JSON - parse `data.content` or `data.results`
</constraints>

<workflow>
### 1. Scope the Query
- What specifically needs to be learned?
- What will the findings be used for?
- What level of depth is needed?

### 2. Choose Approach

| Need | Tool | Cost |
|------|------|------|
| Broad question, need synthesis | `perplexity research` | High |
| Synthesis + real-time validation | `perplexity research --grok-challenge` | Higher |
| X/Twitter community insights | `xai search` | Medium |
| Find sources, discover URLs | `tavily search` | Medium |
| Get full content from known URL | `tavily extract` | Low |

### 3. Process Results
All tools return JSON. Parse `data.content` or `data.results` for findings.
</workflow>

<examples>
### Command Reference
```bash
# Deep research with citations (Perplexity)
envoy perplexity research "query"
envoy perplexity research "query" --grok-challenge  # validate via X search

# X/Twitter search (Grok)
envoy xai search "query"
envoy xai search "query" --results-to-challenge "findings"  # challenger mode

# Web search (Tavily)
envoy tavily search "query"
envoy tavily search "query" --max-results 10

# Extract content from URLs (Tavily)
envoy tavily extract "url1" "url2"

# GitHub content (use gh CLI)
gh api repos/{owner}/{repo}/contents/{path}
gh issue view {number} --repo {owner}/{repo}
```

### Decision Tree
```
Need information?
├─ Know the exact URL? → tavily extract
├─ Need to find sources? → tavily search → extract promising URLs
├─ Tech research for planning? → perplexity research --grok-challenge
└─ Quick answer, no validation? → perplexity research
```

### Output Format
```markdown
## Research: [Topic]

### Key Findings
- Finding with context

### Sources
- [Source URL] - what was relevant

### Recommendations
What to do based on findings.
```
</examples>

<anti_patterns>
- Using extract for GitHub content (use `gh` CLI instead)
- Skipping scope clarification before research
- Not parsing JSON response properly
- Using research tools from non-curator/researcher agents
</anti_patterns>
