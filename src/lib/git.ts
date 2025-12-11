import { execSync, spawnSync } from 'child_process';

export interface GitResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

export function git(args: string[], cwd: string): GitResult {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });

  return {
    success: result.status === 0,
    stdout: result.stdout?.trim() || '',
    stderr: result.stderr?.trim() || '',
  };
}

export function getCurrentBranch(repoPath: string): string {
  const result = git(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath);
  return result.success ? result.stdout : '';
}

export function getRepoName(repoPath: string): string {
  const result = git(['remote', 'get-url', 'origin'], repoPath);
  if (result.success) {
    let name = result.stdout.split('/').pop() || '';
    if (name.endsWith('.git')) {
      name = name.slice(0, -4);
    }
    return name;
  }
  // Fallback to directory name
  return repoPath.split('/').pop() || 'unknown';
}

export function getStagedFiles(repoPath: string): Set<string> {
  const result = git(['diff', '--cached', '--name-only'], repoPath);
  if (!result.success || !result.stdout) {
    return new Set();
  }
  return new Set(result.stdout.split('\n').filter(Boolean));
}

export function isGitRepo(path: string): boolean {
  const result = git(['rev-parse', '--git-dir'], path);
  return result.success;
}

export function ghCli(args: string[], cwd: string): GitResult {
  const result = spawnSync('gh', args, {
    cwd,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });

  return {
    success: result.status === 0,
    stdout: result.stdout?.trim() || '',
    stderr: result.stderr?.trim() || '',
  };
}

export function checkGitInstalled(): boolean {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function checkGhInstalled(): boolean {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
