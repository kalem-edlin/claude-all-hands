---
name: claude-code-patterns
description: Use when building agents, skills, hooks, or tool configs. Contains Claude Code native feature documentation and structure patterns.
---

TODO: Make efficient references to the documentation and how to maintain/stay on top of Claude Code best practices instructions.

Claude Code Best Practices Documentation For Curator Agent:
* General things to remember:
    * https://claudelog.com/mechanics/poison-context-awareness/
    * https://claudelog.com/mechanics/claude-md-supremacy/
* Skills:
    * https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices 
    * https://code.claude.com/docs/en/skills
    * https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills
    * Keep an eye on this PR to know when this functionality becomes available: https://github.com/anthropics/claude-code/issues/12633 
    * Great example that allows human in the loop (where necessary) https://github.com/alonw0/web-asset-generator/blob/main/skills/web-asset-generator/SKILL.md
* Agents:
    * https://code.claude.com/docs/en/sub-agents
    * https://claudelog.com/mechanics/sub-agents/
    * https://claudelog.com/mechanics/split-role-sub-agents/ (ultra think mode seems important here)
    * https://claudelog.com/mechanics/custom-agents/ (community managed agent best practices)
    * https://claudelog.com/mechanics/agent-engineering/
* Hooks:
    * https://code.claude.com/docs/en/hooks
    * https://code.claude.com/docs/en/hooks-guide
* MCP:
    * https://code.claude.com/docs/en/mcp
    * claude-envoy will always be the better option, and curator integrations into that using needed MCP source code will be necessary (based on this practice: https://github.com/n1ira/claude-oracle/tree/main) 
        * https://claudelog.com/claude-code-mcps/reddit-mcp/
        * https://claudelog.com/claude-code-mcps/twitter-mcp/ (if grok API CLI use does not cut it)
    * API based best practices: https://www.anthropic.com/engineering/advanced-tool-use
* Memory Inspiration:
    * https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
    * External solutions:
        * https://agentdb.ruv.io/
        * https://agentdb.ruv.io/demo/management-ide
* Plugin for packaging ready made solution: https://code.claude.com/docs/en/plugins
* Prompt engineering - probably not relevenant:
    * https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview