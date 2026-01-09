/**
 * Tree-sitter utilities for AST parsing and symbol resolution.
 * Used by docs commands for symbol lookup and validation.
 */

import { readFileSync, existsSync } from "fs";
import { extname } from "path";
import {
  getLanguageForExtension,
  getQueriesForLanguage,
  type LanguageQueries,
} from "./ast-queries.js";

export interface SymbolLocation {
  name: string;
  startLine: number;
  endLine: number;
  type: string;
}

export interface ParseResult {
  success: boolean;
  language?: string;
  symbols?: SymbolLocation[];
  error?: string;
}

// Lazy-loaded parsers cache
const parserCache = new Map<string, unknown>();

/**
 * Get or create a tree-sitter parser for a language.
 * Lazily loads grammars to avoid startup cost.
 */
async function getParser(language: string): Promise<unknown | null> {
  if (parserCache.has(language)) {
    return parserCache.get(language)!;
  }

  try {
    // Dynamic import tree-sitter
    const Parser = (await import("tree-sitter")).default;

    // Load language grammar
    let grammar: unknown;
    switch (language) {
      case "typescript":
        grammar = (await import("tree-sitter-typescript")).default.typescript;
        break;
      case "javascript":
        grammar = (await import("tree-sitter-javascript")).default;
        break;
      case "python":
        grammar = (await import("tree-sitter-python")).default;
        break;
      case "go":
        grammar = (await import("tree-sitter-go")).default;
        break;
      case "rust":
        grammar = (await import("tree-sitter-rust")).default;
        break;
      case "java":
        grammar = (await import("tree-sitter-java")).default;
        break;
      case "ruby":
        grammar = (await import("tree-sitter-ruby")).default;
        break;
      case "swift":
        grammar = (await import("tree-sitter-swift")).default;
        break;
      default:
        return null;
    }

    const parser = new Parser();
    parser.setLanguage(grammar as Parameters<typeof parser.setLanguage>[0]);
    parserCache.set(language, parser);
    return parser;
  } catch (e) {
    console.error(`Failed to load parser for ${language}:`, e);
    return null;
  }
}

/**
 * Parse a file and extract all symbol definitions.
 */
export async function parseFile(filePath: string): Promise<ParseResult> {
  const ext = extname(filePath);
  const language = getLanguageForExtension(ext);

  if (!language) {
    return {
      success: false,
      error: `Unsupported file extension: ${ext}`,
    };
  }

  if (!existsSync(filePath)) {
    return {
      success: false,
      error: `File not found: ${filePath}`,
    };
  }

  const parser = await getParser(language);
  if (!parser) {
    return {
      success: false,
      error: `No parser available for ${language}`,
    };
  }

  try {
    const sourceCode = readFileSync(filePath, "utf-8");
    const tree = (parser as { parse(source: string): unknown }).parse(sourceCode);
    const queries = getQueriesForLanguage(language);

    if (!queries) {
      return {
        success: false,
        error: `No queries defined for ${language}`,
      };
    }

    const symbols = extractSymbols(tree, queries, language);

    return {
      success: true,
      language,
      symbols,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Find a specific symbol in a file.
 */
export async function findSymbol(
  filePath: string,
  symbolName: string
): Promise<SymbolLocation | null> {
  const result = await parseFile(filePath);

  if (!result.success || !result.symbols) {
    return null;
  }

  return result.symbols.find((s) => s.name === symbolName) || null;
}

/**
 * Check if a symbol exists in a file.
 */
export async function symbolExists(
  filePath: string,
  symbolName: string
): Promise<boolean> {
  const symbol = await findSymbol(filePath, symbolName);
  return symbol !== null;
}

/**
 * Extract symbols from a parsed tree using queries.
 */
function extractSymbols(
  tree: unknown,
  queries: LanguageQueries,
  language: string
): SymbolLocation[] {
  const symbols: SymbolLocation[] = [];
  const root = (tree as { rootNode: unknown }).rootNode;

  // Walk the tree and match nodes against our query patterns
  // This is a simplified approach - for full query support we'd use tree-sitter's Query class
  walkTree(root, (node: TreeNode) => {
    for (const [symbolType, queryDef] of Object.entries(queries)) {
      const match = matchNode(node, queryDef.query, symbolType, language);
      if (match) {
        symbols.push(match);
      }
    }
  });

  return symbols;
}

interface TreeNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children: TreeNode[];
  childForFieldName?: (name: string) => TreeNode | null;
  namedChildren?: TreeNode[];
}

/**
 * Walk tree recursively, calling callback for each node.
 */
function walkTree(node: TreeNode, callback: (node: TreeNode) => void): void {
  callback(node);
  const children = node.namedChildren || node.children || [];
  for (const child of children) {
    walkTree(child, callback);
  }
}

/**
 * Simple pattern matching for tree-sitter nodes.
 * Matches common declaration patterns without full query syntax.
 */
function matchNode(
  node: TreeNode,
  _queryPattern: string,
  symbolType: string,
  language: string
): SymbolLocation | null {
  // Match based on node type patterns for each language
  const nodeType = node.type;

  // TypeScript/JavaScript patterns
  if (language === "typescript" || language === "javascript") {
    if (symbolType === "function" && nodeType === "function_declaration") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
    if (symbolType === "class" && (nodeType === "class_declaration" || nodeType === "abstract_class_declaration")) {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
    if (symbolType === "variable" && nodeType === "variable_declarator") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
    if (symbolType === "type" && nodeType === "type_alias_declaration") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
    if (symbolType === "interface" && nodeType === "interface_declaration") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
    if (symbolType === "method" && nodeType === "method_definition") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
    if (symbolType === "arrowFunction" && nodeType === "lexical_declaration") {
      // Find variable_declarator with arrow_function value
      const children = node.namedChildren || node.children || [];
      for (const child of children) {
        if (child.type === "variable_declarator") {
          const nameNode = child.childForFieldName?.("name");
          const valueNode = child.childForFieldName?.("value");
          if (nameNode && valueNode?.type === "arrow_function") {
            return makeLocation(nameNode.text, node, "function");
          }
        }
      }
    }
  }

  // Python patterns
  if (language === "python") {
    if (symbolType === "function" && nodeType === "function_definition") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
    if (symbolType === "class" && nodeType === "class_definition") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
  }

  // Go patterns
  if (language === "go") {
    if (symbolType === "function" && nodeType === "function_declaration") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
    if (symbolType === "type" && nodeType === "type_declaration") {
      // Look for type_spec child
      const children = node.namedChildren || node.children || [];
      for (const child of children) {
        if (child.type === "type_spec") {
          const nameNode = child.childForFieldName?.("name");
          if (nameNode) {
            return makeLocation(nameNode.text, node, symbolType);
          }
        }
      }
    }
    if (symbolType === "method" && nodeType === "method_declaration") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
  }

  // Rust patterns
  if (language === "rust") {
    if (symbolType === "function" && nodeType === "function_item") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
    if (symbolType === "struct" && nodeType === "struct_item") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
    if (symbolType === "enum" && nodeType === "enum_item") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
    if (symbolType === "trait" && nodeType === "trait_item") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
  }

  // Java patterns
  if (language === "java") {
    if (symbolType === "class" && nodeType === "class_declaration") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
    if (symbolType === "interface" && nodeType === "interface_declaration") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
    if (symbolType === "method" && nodeType === "method_declaration") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
  }

  // Ruby patterns
  if (language === "ruby") {
    if (symbolType === "function" && nodeType === "method") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
    if (symbolType === "class" && nodeType === "class") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
    if (symbolType === "module" && nodeType === "module") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
  }

  // Swift patterns
  if (language === "swift") {
    if (symbolType === "function" && nodeType === "function_declaration") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
    if (symbolType === "class" && nodeType === "class_declaration") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
    if (symbolType === "struct" && nodeType === "struct_declaration") {
      const nameNode = node.childForFieldName?.("name");
      if (nameNode) {
        return makeLocation(nameNode.text, node, symbolType);
      }
    }
  }

  return null;
}

/**
 * Create a SymbolLocation from node data.
 */
function makeLocation(
  name: string,
  node: TreeNode,
  type: string
): SymbolLocation {
  return {
    name,
    // Tree-sitter uses 0-indexed rows, but git blame uses 1-indexed lines
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    type,
  };
}

/**
 * Get complexity metrics for a file.
 */
export async function getFileComplexity(filePath: string): Promise<{
  lines: number;
  imports: number;
  exports: number;
  functions: number;
  classes: number;
} | null> {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n").length;

    const result = await parseFile(filePath);
    if (!result.success || !result.symbols) {
      // Fallback to regex-based counting for unsupported files
      return {
        lines,
        imports: (content.match(/^import\s/gm) || []).length,
        exports: (content.match(/^export\s/gm) || []).length,
        functions: (content.match(/function\s+\w+/g) || []).length,
        classes: (content.match(/class\s+\w+/g) || []).length,
      };
    }

    const functions = result.symbols.filter(
      (s) => s.type === "function" || s.type === "method" || s.type === "arrowFunction"
    ).length;
    const classes = result.symbols.filter(
      (s) => s.type === "class" || s.type === "struct" || s.type === "interface"
    ).length;

    // Count imports/exports via regex (simpler than AST for this)
    const imports = (content.match(/^import\s/gm) || []).length;
    const exports = (content.match(/^export\s/gm) || []).length;

    return { lines, imports, exports, functions, classes };
  } catch {
    return null;
  }
}
