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

export function checkGitInstalled(): boolean {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
