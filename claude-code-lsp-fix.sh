#!/bin/bash
#
# Claude Code LSP Fix
# ====================
# Fixes the LSP plugin bug: https://github.com/anthropics/claude-code/issues/13952
#
# THE BUG:
#   Claude Code's LSP manager has an empty initialize() function that should
#   load and register LSP servers from plugins, but instead does nothing.
#   This causes "No LSP server available for file type" errors.
#
# THE FIX:
#   This script patches the empty initialize() function to actually:
#   1. Load LSP server configs from enabled plugins
#   2. Create server instances for each config
#   3. Register them so Claude Code can use them
#
# HOW IT WORKS:
#   Uses the acorn JavaScript parser to find the right functions by their
#   structure and string contents (not minified names, which vary between builds).
#   This makes the fix reliable across different installations.
#
# USAGE:
#   ./apply-claude-code-2.0.76-lsp-fix.sh             # Apply the fix
#   ./apply-claude-code-2.0.76-lsp-fix.sh --check     # Check if fix is needed
#   ./apply-claude-code-2.0.76-lsp-fix.sh --restore   # Restore from backup
#   ./apply-claude-code-2.0.76-lsp-fix.sh --fix-plugins  # Fix plugin configs only
#   ./apply-claude-code-2.0.76-lsp-fix.sh --help      # Show this help
#
# REQUIREMENTS:
#   - Node.js (already installed if you have Claude Code)
#   - Internet connection (downloads acorn parser on first run)
#
# NOTE:
#   This patch will be overwritten when Claude Code updates.
#   Re-run this script after updates if LSP stops working.
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}!${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_info() { echo -e "${BLUE}→${NC} $1"; }

# Fix plugin marketplace configs (removes unsupported fields like startupTimeout)
fix_plugin_configs() {
    local marketplace_json="$HOME/.claude/plugins/marketplaces/claude-plugins-official/.claude-plugin/marketplace.json"

    if [ ! -f "$marketplace_json" ]; then
        return 0
    fi

    # Use Node.js for proper JSON manipulation
    node -e "
const fs = require('fs');
const path = '$marketplace_json';
let data;
try {
    data = JSON.parse(fs.readFileSync(path, 'utf8'));
} catch (e) {
    console.log('\x1b[33m!\x1b[0m Plugin config JSON is invalid, skipping');
    process.exit(0);
}
let fixes = [];
const unsupportedFields = ['startupTimeout', 'shutdownTimeout'];
if (data.plugins) {
    for (const plugin of data.plugins) {
        if (plugin.lspServers) {
            for (const [serverName, config] of Object.entries(plugin.lspServers)) {
                for (const field of unsupportedFields) {
                    if (config[field] !== undefined) {
                        delete config[field];
                        fixes.push({ plugin: plugin.name, server: serverName, field });
                    }
                }
            }
        }
    }
}
if (fixes.length > 0) {
    // Backup and write
    fs.copyFileSync(path, path + '.backup');
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
    for (const fix of fixes) {
        console.log('\x1b[32m✓\x1b[0m Fixed ' + fix.plugin + ': removed unsupported \"' + fix.field + '\" from ' + fix.server);
    }
} else {
    console.log('\x1b[32m✓\x1b[0m Plugin configs already clean');
}
"
}

# Show help
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    sed -n '3,36p' "$0" | sed 's/^#//' | sed 's/^ //'
    exit 0
fi

# Handle --fix-plugins (standalone)
if [ "$1" = "--fix-plugins" ]; then
    echo "Fixing plugin configs..."
    fix_plugin_configs
    exit 0
fi

# Find Claude Code cli.js in common installation locations
find_cli_path() {
    local locations=(
        "$HOME/.claude/local/node_modules/@anthropic-ai/claude-code/cli.js"
        "/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js"
        "/usr/lib/node_modules/@anthropic-ai/claude-code/cli.js"
        "$(npm root -g 2>/dev/null)/@anthropic-ai/claude-code/cli.js"
    )
    for path in "${locations[@]}"; do
        if [ -f "$path" ]; then
            echo "$path"
            return 0
        fi
    done
    return 1
}

CLI_PATH=$(find_cli_path) || true
if [ -z "$CLI_PATH" ]; then
    print_error "Claude Code cli.js not found"
    echo ""
    echo "Searched:"
    echo "  ~/.claude/local/node_modules/@anthropic-ai/claude-code/cli.js"
    echo "  /usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js"
    echo "  /usr/lib/node_modules/@anthropic-ai/claude-code/cli.js"
    echo "  \$(npm root -g)/@anthropic-ai/claude-code/cli.js"
    exit 1
fi

# Handle --restore
if [ "$1" = "--restore" ]; then
    restored=0

    # Restore cli.js
    LATEST_BACKUP=$(ls -t "${CLI_PATH}.backup-"* 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        cp "$LATEST_BACKUP" "$CLI_PATH"
        print_status "Restored cli.js from: $LATEST_BACKUP"
        restored=1
    fi

    # Restore plugin config
    MARKETPLACE_JSON="$HOME/.claude/plugins/marketplaces/claude-plugins-official/.claude-plugin/marketplace.json"
    if [ -f "${MARKETPLACE_JSON}.backup" ]; then
        cp "${MARKETPLACE_JSON}.backup" "$MARKETPLACE_JSON"
        print_status "Restored plugin config from backup"
        restored=1
    fi

    if [ $restored -eq 0 ]; then
        print_error "No backups found"
        exit 1
    fi
    exit 0
fi

print_info "Found Claude Code at: $CLI_PATH"
echo ""

# Download acorn JS parser if needed (cached in /tmp)
ACORN_PATH="/tmp/acorn-claude-fix.js"
if [ ! -f "$ACORN_PATH" ]; then
    print_info "Downloading acorn parser..."
    if ! curl -sf https://unpkg.com/acorn@8.14.0/dist/acorn.js -o "$ACORN_PATH"; then
        print_error "Failed to download acorn parser"
        exit 1
    fi
fi

# Create the Node.js patch script
PATCH_SCRIPT="/tmp/claude-lsp-patch-$$.js"

cat > "$PATCH_SCRIPT" << 'NODESCRIPT'
const fs = require('fs');
const acorn = require('/tmp/acorn-claude-fix.js');
const cliPath = process.argv[2];
const checkOnly = process.argv[3] === '--check';
let code = fs.readFileSync(cliPath, 'utf-8');
// Strip shebang for parsing (will restore later)
let shebang = '';
if (code.startsWith('#!')) {
    const idx = code.indexOf('\n');
    shebang = code.slice(0, idx + 1);
    code = code.slice(idx + 1);
}
// Check if already patched (look for our unique variable names)
if (code.includes('let{servers:_S}=await') && code.includes('.set(_N,_I)')) {
    console.log('\x1b[32m✓\x1b[0m Already patched');
    process.exit(2);  // Exit 2 = already patched, no changes
}
// Parse the JavaScript
let ast;
try {
    ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'module' });
} catch (e) {
    console.error('\x1b[31m✗\x1b[0m Failed to parse cli.js:', e.message);
    process.exit(1);
}
// --- AST Helpers ---
// Get source text for a node
const src = (node) => code.slice(node.start, node.end);
// Recursively find all nodes matching a predicate
function findNodes(node, predicate, results = []) {
    if (!node || typeof node !== 'object') return results;
    if (predicate(node)) results.push(node);
    for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
            if (Array.isArray(node[key])) {
                node[key].forEach(child => findNodes(child, predicate, results));
            } else {
                findNodes(node[key], predicate, results);
            }
        }
    }
    return results;
}
// Check if node contains a string literal matching text
function containsString(node, text) {
    const strings = findNodes(node, n => n.type === 'Literal' && typeof n.value === 'string');
    return strings.some(s => s.value.includes(text));
}
// Check if node contains a template literal matching text
function containsTemplate(node, text) {
    const templates = findNodes(node, n => n.type === 'TemplateLiteral');
    return templates.some(t => t.quasis.map(q => q.value.raw).join('').includes(text));
}
// --- Find the functions we need to patch ---
const allFunctions = findNodes(ast, n =>
    n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression'
);
// 1. Find createLspServer() - contains "Starting LSP server instance"
let createServerFunc = null;
for (const fn of allFunctions) {
    if (containsString(fn, 'Starting LSP server instance') || containsTemplate(fn, 'Starting LSP server instance')) {
        createServerFunc = fn;
        break;
    }
}
if (!createServerFunc) {
    console.error('\x1b[31m✗\x1b[0m Could not find createLspServer function');
    console.error('   (looking for function containing "Starting LSP server instance")');
    process.exit(1);
}
const createServerName = createServerFunc.id?.name;
console.log('\x1b[34m→\x1b[0m Found createLspServer:', createServerName);
// 2. Find loadLspServersFromPlugins() - contains "Loaded" + "LSP server" log
let loadServersFunc = null;
for (const fn of allFunctions) {
    const hasLoaded = containsString(fn, 'Loaded') || containsTemplate(fn, 'Loaded');
    const hasLsp = containsString(fn, 'LSP server') || containsTemplate(fn, 'LSP server');
    if (hasLoaded && hasLsp) {
        loadServersFunc = fn;
        break;
    }
}
if (!loadServersFunc) {
    console.error('\x1b[31m✗\x1b[0m Could not find loadLspServersFromPlugins function');
    console.error('   (looking for function containing "Loaded" + "LSP server")');
    process.exit(1);
}
const loadServersName = loadServersFunc.id?.name;
console.log('\x1b[34m→\x1b[0m Found loadLspServersFromPlugins:', loadServersName);
// 3. Find LSP manager factory - has 3 Maps and an empty async initialize()
let lspManagerFunc = null;
let emptyInitFunc = null;
let mapVars = [];
for (const fn of allFunctions) {
    // Look for "new Map()" variable declarations
    const varDecls = findNodes(fn, n => n.type === 'VariableDeclaration');
    const mapInits = [];
    for (const decl of varDecls) {
        for (const d of decl.declarations) {
            if (d.init?.type === 'NewExpression' && d.init.callee?.name === 'Map') {
                mapInits.push(d.id.name);
            }
        }
    }
    // LSP manager has 3+ Maps
    if (mapInits.length >= 3) {
        // Find empty async function inside (the buggy initialize)
        const asyncFuncs = findNodes(fn, n => n.type === 'FunctionDeclaration' && n.async);
        for (const inner of asyncFuncs) {
            const body = inner.body?.body;
            // Empty body or just "return" with no value
            if (body?.length === 0 ||
                (body?.length === 1 && body[0].type === 'ReturnStatement' && !body[0].argument)) {
                lspManagerFunc = fn;
                emptyInitFunc = inner;
                mapVars = mapInits;
                break;
            }
        }
    }
    if (lspManagerFunc) break;
}
if (!lspManagerFunc || !emptyInitFunc) {
    console.error('\x1b[31m✗\x1b[0m Could not find LSP manager with empty initialize()');
    console.error('   (looking for function with 3 Maps + empty async function)');
    process.exit(1);
}
const initFuncName = emptyInitFunc.id?.name;
const serverMap = mapVars[0];  // First map stores servers
const extMap = mapVars[1];     // Second map stores extension->server mappings
console.log('\x1b[34m→\x1b[0m Found empty initialize():', initFuncName);
console.log('\x1b[34m→\x1b[0m Server registry map:', serverMap);
console.log('\x1b[34m→\x1b[0m Extension map:', extMap);
if (checkOnly) {
    console.log('');
    console.log('\x1b[33m!\x1b[0m Patch needed - run without --check to apply');
    process.exit(1);
}
// --- Build and apply the patch ---
// The fix: make initialize() actually load and register LSP servers
const newInitBody = `async function ${initFuncName}(){` +
    `let{servers:_S}=await ${loadServersName}();` +
    `for(let[_N,_C]of Object.entries(_S)){` +
        `let _I=${createServerName}(_N,_C);` +
        `${serverMap}.set(_N,_I);` +
        `for(let[_E,_L]of Object.entries(_C.extensionToLanguage||{})){` +
            `let _M=${extMap}.get(_E)||[];` +
            `_M.push(_N);` +
            `${extMap}.set(_E,_M)` +
        `}` +
    `}` +
`}`;
// Apply patch (preserve shebang)
const newCode = shebang + code.slice(0, emptyInitFunc.start) + newInitBody + code.slice(emptyInitFunc.end);
// Backup original
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupPath = cliPath + '.backup-' + timestamp;
fs.copyFileSync(cliPath, backupPath);
console.log('');
console.log('Backup:', backupPath);
// Write patched file
fs.writeFileSync(cliPath, newCode);
// Verify
if (fs.readFileSync(cliPath, 'utf-8').includes(newInitBody)) {
    console.log('');
    console.log('\x1b[32m✓\x1b[0m Fix applied successfully!');
} else {
    console.error('\x1b[31m✗\x1b[0m Verification failed, restoring backup...');
    fs.copyFileSync(backupPath, cliPath);
    process.exit(1);
}
NODESCRIPT

# Run the patch script
node "$PATCH_SCRIPT" "$CLI_PATH" "$1"
EXIT_CODE=$?

# Cleanup temp script
rm -f "$PATCH_SCRIPT"

# Exit codes: 0 = patched, 1 = error/check-needed, 2 = already patched
if [ $EXIT_CODE -eq 0 ] && [ "$1" != "--check" ]; then
    # Newly patched - fix plugins and show restart message
    echo ""
    fix_plugin_configs
    echo ""
    print_warning "Restart Claude Code for changes to take effect"
elif [ $EXIT_CODE -eq 2 ]; then
    # Already patched - just exit cleanly
    exit 0
fi

exit $EXIT_CODE
