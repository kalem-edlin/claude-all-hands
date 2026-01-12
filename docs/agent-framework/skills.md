---
description: Skill system enabling modular domain expertise loaded on demand, with router pattern for complex skills, research and documentation lookup capabilities, and progressive disclosure to minimize agent context consumption.
---

# Skill System

## Overview

Skills solve the expertise distribution problem. Different tasks require different domain knowledge, but loading all knowledge into every agent would exhaust context windows. Skills are modular, filesystem-based capabilities that provide domain expertise on demand. When an agent is configured with skills in its frontmatter, those skills are loaded into the agent's context automatically at invocation. This keeps agents focused while still having access to relevant expertise.

The skill system now includes specialized capabilities for external information: research tools for web search and content extraction, external docs for third-party library documentation, and codebase understanding for project-internal patterns. This separation ensures agents use the right tool for each information need.

## Key Decisions

**Skills are prompts, not code**: A skill is fundamentally a prompt document that teaches Claude how to do something. All prompting best practices apply: be clear, be direct, use XML structure. The SKILL.md file [ref:.claude/skills/skills-development/SKILL.md::4dcde68] is always loaded when a skill is invoked, making it the guaranteed entry point.

**Router pattern for complex skills**: Simple skills can be single files, but complex skills use a directory structure with SKILL.md as a router. The router asks what the user wants to do, then routes to appropriate workflow files. Workflow files specify which reference files to read. This progressive disclosure pattern means agents only load the context they need for their specific task.

**Workflows versus references**: Workflows are procedures agents follow step-by-step. References are domain knowledge agents read for context. The distinction matters for how agents interact with them: workflows are imperatives (do this, then that), references are informational (here's how X works). Templates and scripts round out the structure - templates are output structures to copy and fill, scripts are executable code to run.

**Pure XML structure**: Skill bodies use XML tags, not markdown headings. This is not aesthetic - it is functional. XML tags provide semantic structure that Claude parses more reliably than markdown headers, especially in long documents. Markdown formatting (bold, lists, code blocks) is allowed within content, but section structure is XML.

**500-line limit for SKILL.md**: When SKILL.md exceeds 500 lines, it should split content into reference files and load them on demand. This constraint forces skill authors to prioritize essential principles (what belongs in SKILL.md) versus detailed reference (what belongs in subdirectories).

**Research tools separation from codebase understanding**: The research-tools skill [ref:.claude/skills/research-tools/SKILL.md::b6b2998] provides web search, deep research with citations, and URL content extraction. This is distinct from codebase-understanding which handles project-internal patterns. The separation prevents confusion about when to search externally versus explore the local codebase.

**External docs for library documentation**: The external-docs skill [ref:.claude/skills/external-docs/SKILL.md::b6b2998] provides third-party library and package documentation via Context7. This fills the gap between web search (too broad) and codebase understanding (project only). When an agent needs to understand how a dependency works, external-docs provides targeted documentation.

**Research access restricted to specific agents**: Only curator and researcher agents may use research tools. This prevents implementation agents from going down research rabbit holes during execution. Discovery phases use the researcher agent, implementation phases assume research is complete.

## Patterns

**Skill frontmatter**: Every SKILL.md starts with YAML frontmatter containing name (matching directory) and description (what it does and when to use it). The description field helps agents and users understand when this skill applies.

**Intake and routing**: Complex skills start with an intake section that asks the user what they want to do. The routing section maps answers to workflow files. This prevents the skill from dumping all its knowledge on every invocation.

**Required reading in workflows**: Workflow files specify which references to load before executing steps. This makes dependencies explicit and ensures consistent context across invocations of the same workflow.

**Skill naming conventions**: Names use lowercase-with-hyphens format and typically start with verbs: create-*, manage-*, setup-*, generate-*, build-*. The name should hint at what the skill does.

**Skill references with slash prefix**: When referencing skills in prose, always prefix with slash: /codebase-understanding, /research-tools, /external-docs. This convention distinguishes skill names from other identifiers and matches invocation syntax.

**Information source decision tree**: Agents follow a clear hierarchy when seeking information. For project code and patterns, use /codebase-understanding. For library and package documentation, use /external-docs. For web search and research, use /research-tools. For GitHub content, use gh CLI directly.

## Use Cases

**Agent loads domain expertise**: The curator [ref:.claude/agents/curator.md::b6b2998] has skills configured for orchestration patterns, envoy patterns, and development patterns for skills, subagents, hooks, and commands. When invoked, these skills load automatically, giving the curator access to best practices without requiring the main agent to include that context in its delegation.

**Creating new skills**: The skills-development skill [ref:.claude/skills/skills-development/SKILL.md::4dcde68] is meta - it teaches how to create other skills. It routes between creating new skills, auditing existing ones, adding components, and getting guidance. The curator loads this skill when asked to create a new skill.

**Claude Code patterns**: The claude-code-patterns skill [ref:.claude/skills/claude-code-patterns/SKILL.md::b6b2998] maps task types to official documentation. When building skills, agents, hooks, or tools, this skill points to the right reference docs. It aggregates Claude Code knowledge that would otherwise require external lookups.

**External library research**: A developer needs to understand how a third-party package works. The researcher agent loads /external-docs, searches Context7 for the library, and retrieves targeted documentation. This avoids web search noise while providing authoritative package documentation.

**Deep research for planning**: During discovery phase, the surveyor needs best practices for implementing a feature. The researcher agent loads /research-tools and uses Perplexity for synthesized research with citations. Optionally, Grok challenge validates findings against real-time community signals.

**Codebase pattern discovery**: An agent needs to understand existing project patterns before implementing a new feature. The /codebase-understanding skill [ref:.claude/skills/codebase-understanding/SKILL.md::b6b2998] provides internal knowledge base search, embedding-based retrieval, and project documentation access. This grounds implementation in established patterns.
