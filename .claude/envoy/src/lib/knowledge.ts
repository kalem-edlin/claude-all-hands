/**
 * KnowledgeService - USearch-based semantic search for documentation.
 * Uses @visheratin/web-ai-node for embeddings and usearch for HNSW indexing.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative, extname } from "path";
import { Index, MetricKind, ScalarKind, type Matches } from "usearch";
import matter from "gray-matter";

// Types
interface DocumentMeta {
  description: string;
  relevant_files: string[];
  token_count: number;
}

interface IndexMetadata {
  id_to_path: Record<string, string>;
  path_to_id: Record<string, string>;
  documents: Record<string, DocumentMeta>;
  next_id: number;
  lastUpdated: string;
}

interface SearchResult {
  resource_path: string;
  similarity: number;
  token_count: number;
  description: string;
  relevant_files: string[];
  full_resource_context?: string;
}

interface ReindexResult {
  files_indexed: number;
  total_tokens: number;
}

interface FileChange {
  path: string;
  added?: boolean;
  deleted?: boolean;
  modified?: boolean;
}

interface IndexConfig {
  name: string;
  paths: string[];
  extensions: string[];
  description: string;
  /** Whether this index expects front-matter with description/relevant_files */
  hasFrontmatter: boolean;
}

// Configuration
const INDEX_CONFIGS: Record<string, IndexConfig> = {
  docs: {
    name: "docs",
    paths: ["docs/"],
    extensions: [".md"],
    description: "Project documentation for all agents",
    hasFrontmatter: true,
  },
  curator: {
    name: "curator",
    paths: [
      ".claude/agents/",
      ".claude/hooks/",
      ".claude/skills/",
      ".claude/commands/",
      ".claude/output-styles/",
      ".claude/envoy/README.md",
      ".claude/settings.json",
      ".claude/envoy/src/",
      ".claude/envoy/package.json",
    ],
    extensions: [".md", ".yaml", ".yml", ".ts", ".json"],
    description: ".claude/ files for curator agent",
    hasFrontmatter: false,
  },
};

// File reference patterns for auto-populating relevant_files
const FILE_REF_PATTERNS = [
  /`([a-zA-Z0-9_\-./]+\.[a-zA-Z]+)`/g,
  /\[.*?\]\(([a-zA-Z0-9_\-./]+\.[a-zA-Z]+)\)/g,
  /(?:src|lib|components|utils|hooks|services)\/[a-zA-Z0-9_\-./]+\.[a-zA-Z]+/g,
];

// Environment config with defaults
const SEARCH_SIMILARITY_THRESHOLD = parseFloat(
  process.env.SEARCH_SIMILARITY_THRESHOLD ?? "0.64"
);
const SEARCH_CONTEXT_TOKEN_LIMIT = parseInt(
  process.env.SEARCH_CONTEXT_TOKEN_LIMIT ?? "5000",
  10
);
const SEARCH_FULL_CONTEXT_SIMILARITY_THRESHOLD = parseFloat(
  process.env.SEARCH_FULL_CONTEXT_SIMILARITY_THRESHOLD ?? "0.72"
);

export class KnowledgeService {
  private model: unknown = null;
  private readonly knowledgeDir: string;
  private readonly projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.knowledgeDir = join(projectRoot, ".claude", "envoy", ".knowledge");
  }

  /**
   * Ensure .knowledge/ directory exists
   */
  ensureDir(): void {
    if (!existsSync(this.knowledgeDir)) {
      mkdirSync(this.knowledgeDir, { recursive: true });
    }
  }

  /**
   * Lazy-load embedding model (first use downloads ~100-400MB)
   */
  async getModel(): Promise<unknown> {
    if (this.model) return this.model;

    const { TextModel } = await import("@visheratin/web-ai-node/text");
    const modelResult = await TextModel.create("gtr-t5-quant");
    this.model = modelResult.model;
    return this.model;
  }

  /**
   * Generate embedding for text
   */
  async embed(text: string): Promise<Float32Array> {
    const model = await this.getModel();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (model as any).process(text);
    return new Float32Array(result.result);
  }


  /**
   * Convert cosine distance to similarity (0-1 scale)
   * Cosine distance: 0 = identical, 1 = orthogonal, 2 = opposite
   */
  distanceToSimilarity(distance: number): number {
    return 1 - distance / 2;
  }

  /**
   * Get index file paths
   */
  private getIndexPaths(indexName: string): { index: string; meta: string } {
    return {
      index: join(this.knowledgeDir, `${indexName}.usearch`),
      meta: join(this.knowledgeDir, `${indexName}.meta.json`),
    };
  }

  /**
   * Create empty index metadata
   */
  private createEmptyMetadata(): IndexMetadata {
    return {
      id_to_path: {},
      path_to_id: {},
      documents: {},
      next_id: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Create a new USearch index
   */
  private createIndex(): Index {
    return new Index(
      768,                // dimensions
      MetricKind.Cos,     // metric
      ScalarKind.F32,     // quantization
      16                  // connectivity
    );
  }

  /**
   * Load index + metadata from disk
   */
  async loadIndex(
    indexName: string
  ): Promise<{ index: Index; meta: IndexMetadata }> {
    const paths = this.getIndexPaths(indexName);

    if (!existsSync(paths.index) || !existsSync(paths.meta)) {
      return {
        index: this.createIndex(),
        meta: this.createEmptyMetadata(),
      };
    }

    const index = this.createIndex();
    index.load(paths.index);

    const meta: IndexMetadata = JSON.parse(readFileSync(paths.meta, "utf-8"));
    return { index, meta };
  }

  /**
   * Save index + metadata to disk
   */
  async saveIndex(
    indexName: string,
    index: Index,
    meta: IndexMetadata
  ): Promise<void> {
    this.ensureDir();
    const paths = this.getIndexPaths(indexName);

    meta.lastUpdated = new Date().toISOString();
    index.save(paths.index);
    writeFileSync(paths.meta, JSON.stringify(meta, null, 2));
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 chars)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Discover files for an index based on config
   */
  private discoverFiles(config: IndexConfig): string[] {
    const files: string[] = [];

    for (const configPath of config.paths) {
      const fullPath = join(this.projectRoot, configPath);

      if (!existsSync(fullPath)) continue;

      const stat = statSync(fullPath);
      if (stat.isFile()) {
        if (config.extensions.includes(extname(fullPath))) {
          files.push(configPath);
        }
      } else if (stat.isDirectory()) {
        this.walkDir(fullPath, config.extensions, files, this.projectRoot);
      }
    }

    return files;
  }

  /**
   * Recursively walk directory and collect files
   */
  private walkDir(
    dir: string,
    extensions: string[],
    files: string[],
    projectRoot: string
  ): void {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and hidden dirs (except .claude)
        if (entry.name === "node_modules" || (entry.name.startsWith(".") && entry.name !== ".claude")) {
          continue;
        }
        this.walkDir(fullPath, extensions, files, projectRoot);
      } else if (entry.isFile() && extensions.includes(extname(entry.name))) {
        files.push(relative(projectRoot, fullPath));
      }
    }
  }

  /**
   * Extract file references from document content
   */
  private extractFileReferences(content: string): string[] {
    const refs = new Set<string>();

    for (const pattern of FILE_REF_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(content)) !== null) {
        const ref = match[1] || match[0];
        if (ref && !ref.startsWith("http") && !ref.startsWith("#")) {
          refs.add(ref);
        }
      }
    }

    return Array.from(refs);
  }

  /**
   * Validate file references exist
   */
  private validateFileReferences(refs: string[]): { valid: string[]; missing: string[] } {
    const valid: string[] = [];
    const missing: string[] = [];

    for (const ref of refs) {
      const fullPath = join(this.projectRoot, ref);
      if (existsSync(fullPath)) {
        valid.push(ref);
      } else {
        missing.push(ref);
      }
    }

    return { valid, missing };
  }

  /**
   * Index a single document
   */
  async indexDocument(
    index: Index,
    meta: IndexMetadata,
    path: string,
    content: string,
    frontMatterData: Record<string, unknown>
  ): Promise<bigint> {
    // Assign or reuse ID
    let id: bigint;
    if (meta.path_to_id[path]) {
      id = BigInt(meta.path_to_id[path]);
    } else {
      id = BigInt(meta.next_id++);
      meta.id_to_path[id.toString()] = path;
      meta.path_to_id[path] = id.toString();
    }

    // Generate embedding
    const embedding = await this.embed(content);

    // Add to index
    index.add(id, embedding);

    // Store metadata
    meta.documents[path] = {
      description: (frontMatterData.description as string) || "",
      relevant_files: (frontMatterData.relevant_files as string[]) || [],
      token_count: this.estimateTokens(content),
    };

    return id;
  }

  /**
   * Search with similarity computation
   */
  async search(indexName: string, query: string, k: number = 50): Promise<SearchResult[]> {
    const { index, meta } = await this.loadIndex(indexName);

    if (Object.keys(meta.documents).length === 0) {
      return [];
    }

    // Generate query embedding
    const queryEmbedding = await this.embed(query);

    // Search (1 thread for CLI usage)
    const searchResult = index.search(queryEmbedding, k, 1);
    const keys = searchResult.keys;
    const distances = searchResult.distances;

    // Convert to results
    const results: SearchResult[] = [];
    let totalTokens = 0;

    for (let i = 0; i < keys.length; i++) {
      const id = keys[i].toString();
      const distance = distances[i];
      const similarity = this.distanceToSimilarity(distance);

      // Filter by threshold
      if (similarity < SEARCH_SIMILARITY_THRESHOLD) continue;

      const path = meta.id_to_path[id];
      if (!path) continue;

      const docMeta = meta.documents[path];
      if (!docMeta) continue;

      // Check token limit
      if (totalTokens + docMeta.token_count > SEARCH_CONTEXT_TOKEN_LIMIT) continue;
      totalTokens += docMeta.token_count;

      const result: SearchResult = {
        resource_path: path,
        similarity,
        token_count: docMeta.token_count,
        description: docMeta.description,
        relevant_files: docMeta.relevant_files,
      };

      // Include full context for high-similarity results
      if (similarity >= SEARCH_FULL_CONTEXT_SIMILARITY_THRESHOLD) {
        const fullPath = join(this.projectRoot, path);
        if (existsSync(fullPath)) {
          result.full_resource_context = readFileSync(fullPath, "utf-8");
        }
      }

      results.push(result);
    }

    return results;
  }

  /**
   * Full reindex for an index
   */
  async reindexAll(indexName?: string): Promise<Record<string, ReindexResult>> {
    this.ensureDir();
    const results: Record<string, ReindexResult> = {};

    const indexes = indexName ? [indexName] : Object.keys(INDEX_CONFIGS);

    for (const name of indexes) {
      const config = INDEX_CONFIGS[name];
      if (!config) {
        throw new Error(`Unknown index: ${name}`);
      }

      // Create fresh index
      const index = this.createIndex();
      const meta = this.createEmptyMetadata();

      // Discover and index files
      const files = this.discoverFiles(config);
      let totalTokens = 0;

      for (const filePath of files) {
        const fullPath = join(this.projectRoot, filePath);
        const content = readFileSync(fullPath, "utf-8");

        // Parse front-matter only for indexes that support it
        let frontMatter: Record<string, unknown> = {};
        if (config.hasFrontmatter && filePath.endsWith(".md")) {
          try {
            const parsed = matter(content);
            frontMatter = parsed.data;
          } catch {
            // Skip files with invalid front-matter
          }
        }

        await this.indexDocument(index, meta, filePath, content, frontMatter);
        totalTokens += meta.documents[filePath].token_count;
      }

      // Save
      await this.saveIndex(name, index, meta);

      results[name] = {
        files_indexed: files.length,
        total_tokens: totalTokens,
      };
    }

    return results;
  }

  /**
   * Incremental reindex from changed files
   */
  async reindexFromChanges(
    indexName: string,
    changes: FileChange[]
  ): Promise<{
    success: boolean;
    message: string;
    missing_references?: { doc_path: string; missing_files: string[] }[];
    files: { path: string; action: string }[];
  }> {
    const config = INDEX_CONFIGS[indexName];
    if (!config) {
      throw new Error(`Unknown index: ${indexName}`);
    }

    const { index, meta } = await this.loadIndex(indexName);
    const processedFiles: { path: string; action: string }[] = [];
    const missingReferences: { doc_path: string; missing_files: string[] }[] = [];

    for (const change of changes) {
      const { path, added, deleted, modified } = change;

      // Check if file matches index config
      const matchesConfig = config.paths.some((p) => path.startsWith(p)) &&
        config.extensions.includes(extname(path));

      if (!matchesConfig) continue;

      if (deleted) {
        // Remove from index
        const id = meta.path_to_id[path];
        if (id) {
          // Note: USearch doesn't have a remove method in basic API
          // We mark as deleted in metadata
          delete meta.id_to_path[id];
          delete meta.path_to_id[path];
          delete meta.documents[path];
          processedFiles.push({ path, action: "deleted" });
        }
      } else if (added || modified) {
        const fullPath = join(this.projectRoot, path);
        if (!existsSync(fullPath)) continue;

        const content = readFileSync(fullPath, "utf-8");
        let frontMatter: Record<string, unknown> = {};

        // Only process front-matter and file references for indexes that support it
        if (config.hasFrontmatter && path.endsWith(".md")) {
          try {
            const parsed = matter(content);
            frontMatter = parsed.data;

            // Extract and validate file references
            const refs = this.extractFileReferences(parsed.content);
            const { valid, missing } = this.validateFileReferences(refs);

            if (missing.length > 0) {
              missingReferences.push({ doc_path: path, missing_files: missing });
            }

            // Auto-populate relevant_files
            if (valid.length > 0) {
              frontMatter.relevant_files = valid;
              // Write back with updated front-matter
              const newContent = matter.stringify(parsed.content, frontMatter);
              writeFileSync(fullPath, newContent);
            }
          } catch {
            // Skip files with invalid front-matter
          }
        }

        // Index document
        await this.indexDocument(index, meta, path, content, frontMatter);
        processedFiles.push({ path, action: added ? "added" : "modified" });
      }
    }

    // Save updated index
    await this.saveIndex(indexName, index, meta);

    if (missingReferences.length > 0) {
      return {
        success: false,
        message: "Documents contain references to missing files",
        missing_references: missingReferences,
        files: processedFiles,
      };
    }

    return {
      success: true,
      message: "Index updated successfully",
      files: processedFiles,
    };
  }

  /**
   * Check if indexes exist and are valid
   */
  async checkIndexes(): Promise<{ valid: string[]; missing: string[] }> {
    const valid: string[] = [];
    const missing: string[] = [];

    for (const name of Object.keys(INDEX_CONFIGS)) {
      const paths = this.getIndexPaths(name);
      if (existsSync(paths.index) && existsSync(paths.meta)) {
        valid.push(name);
      } else {
        missing.push(name);
      }
    }

    return { valid, missing };
  }
}

export { INDEX_CONFIGS };
export type { SearchResult, ReindexResult, FileChange, IndexMetadata, DocumentMeta };
