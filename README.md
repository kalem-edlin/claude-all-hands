  "mcpServers": {
    "perplexity": {
      "command": "npx",
      "args": ["-y", "perplexity-mcp"],
      "defer_loading": true,
      "env": {
        "PERPLEXITY_API_KEY": "${CLAUDE_PERPLEXITY_API_KEY}"
      }
    }
  }