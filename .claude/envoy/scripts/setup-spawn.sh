#!/bin/bash
# Setup script for envoy spawn commands (Gemini UI/UX agent)
# Installs opencode CLI via bun and configures antigravity auth plugin

set -e

echo "=== Envoy Spawn Setup ==="
echo ""

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "[!] bun not found. Installing bun..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    echo "[✓] bun installed"
fi

# Check if opencode is installed
if command -v opencode &> /dev/null; then
    OPENCODE_VERSION=$(opencode --version 2>/dev/null || echo "unknown")
    echo "[✓] opencode CLI installed (v$OPENCODE_VERSION)"
else
    echo "[!] opencode CLI not found. Installing via bun..."
    bun install -g opencode
    echo "[✓] opencode CLI installed"
fi

# Create config directory
OPENCODE_CONFIG_DIR="$HOME/.config/opencode"
mkdir -p "$OPENCODE_CONFIG_DIR"

# Install antigravity plugin if not present
if [ -d "$OPENCODE_CONFIG_DIR/node_modules/opencode-antigravity-auth" ]; then
    echo "[✓] antigravity plugin already installed"
else
    echo "[!] Installing antigravity auth plugin..."
    cd "$OPENCODE_CONFIG_DIR"

    # Initialize package.json if needed
    if [ ! -f "package.json" ]; then
        echo '{}' > package.json
    fi

    bun add opencode-antigravity-auth@beta
    cd - > /dev/null
    echo "[✓] antigravity plugin installed"
fi

# Configure opencode.json with plugin and models
OPENCODE_CONFIG="$OPENCODE_CONFIG_DIR/opencode.json"
if [ -f "$OPENCODE_CONFIG" ] && grep -q "opencode-antigravity-auth" "$OPENCODE_CONFIG"; then
    echo "[✓] opencode.json already configured"
else
    echo "[!] Configuring opencode.json..."
    cat > "$OPENCODE_CONFIG" << 'EOF'
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-antigravity-auth@beta"],
  "provider": {
    "google": {
      "models": {
        "antigravity-gemini-3-pro": {
          "name": "Gemini 3 Pro (Antigravity)",
          "limit": { "context": 1048576, "output": 65535 },
          "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] },
          "variants": {
            "low": { "thinkingLevel": "low" },
            "high": { "thinkingLevel": "high" }
          }
        },
        "antigravity-gemini-3-flash": {
          "name": "Gemini 3 Flash (Antigravity)",
          "limit": { "context": 1048576, "output": 65536 },
          "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] },
          "variants": {
            "minimal": { "thinkingLevel": "minimal" },
            "low": { "thinkingLevel": "low" },
            "medium": { "thinkingLevel": "medium" },
            "high": { "thinkingLevel": "high" }
          }
        },
        "antigravity-claude-sonnet-4-5": {
          "name": "Claude Sonnet 4.5 (no thinking) (Antigravity)",
          "limit": { "context": 200000, "output": 64000 },
          "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] }
        },
        "antigravity-claude-sonnet-4-5-thinking": {
          "name": "Claude Sonnet 4.5 Thinking (Antigravity)",
          "limit": { "context": 200000, "output": 64000 },
          "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] },
          "variants": {
            "low": { "thinkingConfig": { "thinkingBudget": 8192 } },
            "max": { "thinkingConfig": { "thinkingBudget": 32768 } }
          }
        },
        "antigravity-claude-opus-4-5-thinking": {
          "name": "Claude Opus 4.5 Thinking (Antigravity)",
          "limit": { "context": 200000, "output": 64000 },
          "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] },
          "variants": {
            "low": { "thinkingConfig": { "thinkingBudget": 8192 } },
            "max": { "thinkingConfig": { "thinkingBudget": 32768 } }
          }
        },
        "gemini-2.5-flash": {
          "name": "Gemini 2.5 Flash (Gemini CLI)",
          "limit": { "context": 1048576, "output": 65536 },
          "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] }
        },
        "gemini-2.5-pro": {
          "name": "Gemini 2.5 Pro (Gemini CLI)",
          "limit": { "context": 1048576, "output": 65536 },
          "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] }
        },
        "gemini-3-flash-preview": {
          "name": "Gemini 3 Flash Preview (Gemini CLI)",
          "limit": { "context": 1048576, "output": 65536 },
          "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] }
        },
        "gemini-3-pro-preview": {
          "name": "Gemini 3 Pro Preview (Gemini CLI)",
          "limit": { "context": 1048576, "output": 65535 },
          "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] }
        }
      }
    }
  }
}
EOF
    echo "[✓] opencode.json configured"
fi

# Check if authenticated
ACCOUNTS_FILE="$OPENCODE_CONFIG_DIR/antigravity-accounts.json"
if [ -f "$ACCOUNTS_FILE" ] && [ -s "$ACCOUNTS_FILE" ]; then
    ACCOUNT_COUNT=$(grep -o '"email"' "$ACCOUNTS_FILE" 2>/dev/null | wc -l | tr -d ' ')
    echo "[✓] Google OAuth credentials found ($ACCOUNT_COUNT account(s))"
else
    echo ""
    echo "[!] Google OAuth authentication required."
    echo "    This will open a browser for Google sign-in."
    echo ""
    read -p "Run 'opencode auth login' now? [Y/n] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        opencode auth login
    else
        echo ""
        echo "⚠️  Run 'opencode auth login' manually before using spawn commands."
    fi
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Test with:"
echo "  envoy spawn gemini-ui-ux \"Say hello\""
echo ""
echo "For persistent sessions:"
echo "  envoy spawn gemini-ui-ux \"Create a button\" --persistent"
echo "  envoy spawn gemini-ui-ux \"Add hover effect\" --pid <PID>"
echo "  envoy spawn kill <PID>"
echo ""
