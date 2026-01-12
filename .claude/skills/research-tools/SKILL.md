---
name: research-tools
description: Web research and content extraction. Use for "search the web", "research [topic]", "extract URL content", "find sources". Provides Tavily (search/extract), Perplexity (deep research), Grok (X/Twitter). For library docs, use /external-docs skill instead.
---

<objective>
External research capability for agents. Web search, deep research with citations, and real-time social signals via envoy commands. For library/package documentation, use /external-docs skill instead.
</objective>

<quick_start>
```bash
# Deep research (Perplexity)
envoy perplexity research "query"

# Web search (Tavily)
envoy tavily search "query"

# Extract URL content
envoy tavily extract "url1" "url2"

# X/Twitter insights (Grok)
envoy xai search "query"
```
</quick_start>

<constraints>
- Only curator/researcher agents may use these tools
- GitHub content: use `gh` CLI instead of extract
- All commands return JSON - parse `data.content` or `data.results`
- Use TODAY's date for time-sensitive queries: `date +%Y-%m-%d`
- Library/package docs: use /external-docs skill (Context7) instead
</constraints>

<workflow>
<step name="scope">
Clarify: What to learn? What for? Depth needed?
</step>

<step name="choose_tool">
| Need | Tool | Cost |
|------|------|------|
| Broad question, synthesis | `perplexity research` | High |
| Synthesis + real-time validation | `perplexity research --grok-challenge` | Higher |
| X/Twitter community insights | `xai search` | Medium |
| Find sources, discover URLs | `tavily search` | Medium |
| Full content from known URL | `tavily extract` | Low |
| Library/package docs | Use /external-docs skill | - |
</step>

<step name="process_results">
All tools return JSON. Parse `data.content` or `data.results` for findings.
</step>
</workflow>

<examples>
<command_reference>
```bash
# Perplexity (deep research)
envoy perplexity research "query"
envoy perplexity research "query" --grok-challenge

# Grok (X/Twitter)
envoy xai search "query"
envoy xai search "query" --results-to-challenge "findings"

# Tavily (web search/extract)
envoy tavily search "query"
envoy tavily search "query" --max-results 10
envoy tavily extract "url1" "url2"

# GitHub (use gh CLI)
gh api repos/{owner}/{repo}/contents/{path}
gh issue view {number} --repo {owner}/{repo}
```
</command_reference>

<decision_tree>
```
Need information?
├─ Library/package docs? → use /external-docs skill
├─ Know exact URL? → tavily extract
├─ Need to find sources? → tavily search → extract promising URLs
├─ Tech research for planning? → perplexity research --grok-challenge
├─ Implementation patterns/best practices? → perplexity research
└─ Quick answer, no validation? → perplexity research
```
</decision_tree>

<output_format>
```markdown
## Research: [Topic]

### Key Findings
- Finding with context

### Sources
- [URL] - relevance

### Recommendations
Actions based on findings.
```
</output_format>
</examples>

<anti_patterns>
- Using extract for GitHub content (use `gh` CLI)
- Skipping scope clarification before research
- Not parsing JSON response properly
- Using from non-curator/researcher agents
- Using for library docs (use /external-docs skill instead)
</anti_patterns>

<success_criteria>
- JSON response: `status: success` with `data` containing findings
- Sources/citations included for synthesis queries
- Content extracted for known URLs
</success_criteria>
