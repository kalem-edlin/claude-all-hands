---
name: external-docs
description: Third-party library/package documentation lookup. Use for "how does library X work", "library docs for [package]", "API reference for [dependency]". Uses Context7 search → context flow.
---

<objective>
Third-party library and package documentation lookup via Context7. For external dependency documentation - distinct from codebase-understanding (project-internal patterns/docs).
</objective>

<quick_start>
```bash
# Step 1: Search for library (get libraryId)
envoy context7 search "react"
envoy context7 search "fastify" "middleware patterns"

# Step 2: Get docs using libraryId from search
envoy context7 context "/facebook/react" "hooks usage"
envoy context7 context "/fastify/fastify" "routing" --text
```
</quick_start>

<constraints>
- Requires search → context flow (search gives libraryId for context command)
- Use `--text` for direct LLM consumption (no JSON parsing needed)
- Be specific in query to get relevant docs only
- NOT for project-internal docs (use /codebase-understanding instead)
- NOT for general web search (use /research-tools instead)
</constraints>

<workflow>
<step name="search">
Find library and get its ID:
```bash
envoy context7 search "react"
# Returns: { results: [{ id: "/facebook/react", name: "React", ... }] }
```
</step>

<step name="context">
Get docs for specific questions using the ID:
```bash
envoy context7 context "/facebook/react" "useState and useEffect"
# Returns: { docs: [{ title, content, source }] }
```
</step>
</workflow>

<examples>
<command_reference>
```bash
# Search for libraries
envoy context7 search "react"                              # Find react libraries
envoy context7 search "fastify" "middleware handling"      # Search with query context

# Get documentation
envoy context7 context "/facebook/react" "hooks"           # Get docs (JSON)
envoy context7 context "/facebook/react" "hooks" --text    # Get docs (plain text)
```
</command_reference>

<decision_tree>
```
Need library/package docs?
├─ How does library X work? → context7 search "X" → context7 context "<id>" "question"
├─ Library docs for codebase dependency? → context7 search → context7 context
├─ General web search? → use /research-tools skill instead
└─ Project-internal patterns? → use /codebase-understanding skill instead
```
</decision_tree>
</examples>

<anti_patterns>
- Calling context7 context without searching first (need libraryId)
- Using for non-library questions (use /research-tools skill instead)
- Using for project-internal documentation (use /codebase-understanding skill instead)
- Not using `--text` when result goes directly to LLM
</anti_patterns>

<success_criteria>
- Valid libraryId obtained from search before context call
- Specific, relevant documentation retrieved
- Minimal context loaded (use `--text`, specific queries)
</success_criteria>
