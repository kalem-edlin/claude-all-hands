import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { minimatch } from 'minimatch';

interface ManifestData {
  distribute?: string[];
  internal?: string[];
  exclude?: string[];
}

export class Manifest {
  private allhandsRoot: string;
  private manifestPath: string;
  private data: ManifestData;

  constructor(allhandsRoot: string) {
    this.allhandsRoot = allhandsRoot;
    this.manifestPath = join(allhandsRoot, '.allhands-manifest.json');
    this.data = this.load();
  }

  private load(): ManifestData {
    if (!existsSync(this.manifestPath)) {
      throw new Error(`Manifest not found: ${this.manifestPath}`);
    }
    const content = readFileSync(this.manifestPath, 'utf-8');
    return JSON.parse(content);
  }

  get distributePatterns(): string[] {
    return this.data.distribute || [];
  }

  get internalPatterns(): string[] {
    return this.data.internal || [];
  }

  get excludePatterns(): string[] {
    return this.data.exclude || [];
  }

  isExcluded(path: string): boolean {
    return this.excludePatterns.some(pattern => this.matches(path, pattern));
  }

  isDistributable(path: string): boolean {
    return this.distributePatterns.some(pattern => this.matches(path, pattern));
  }

  isInternal(path: string): boolean {
    return this.internalPatterns.some(pattern => this.matches(path, pattern));
  }

  private matches(path: string, pattern: string): boolean {
    return minimatch(path, pattern, { dot: true });
  }

  getDistributableFiles(): Set<string> {
    const allFiles = new Set<string>();
    this.walkDir(this.allhandsRoot, (filePath) => {
      allFiles.add(relative(this.allhandsRoot, filePath));
    });

    const filtered = new Set<string>();
    for (const file of allFiles) {
      if (this.isDistributable(file) && !this.isExcluded(file)) {
        filtered.add(file);
      }
    }

    return filtered;
  }

  private walkDir(dir: string, callback: (filePath: string) => void): void {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') {
        continue;
      }
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        this.walkDir(fullPath, callback);
      } else if (entry.isFile()) {
        callback(fullPath);
      }
    }
  }
}

export function loadIgnorePatterns(targetRoot: string): string[] {
  const ignoreFile = join(targetRoot, '.allhandsignore');
  if (!existsSync(ignoreFile)) {
    return [];
  }

  const content = readFileSync(ignoreFile, 'utf-8');
  const patterns: string[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      patterns.push(trimmed);
    }
  }

  return patterns;
}

export function isIgnored(path: string, patterns: string[]): boolean {
  return patterns.some(pattern => minimatch(path, pattern, { dot: true }));
}
