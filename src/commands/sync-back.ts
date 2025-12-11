import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join, relative, dirname } from 'path';
import { tmpdir } from 'os';
import { Manifest, loadIgnorePatterns, isIgnored } from '../lib/manifest.js';
import { git, ghCli, getCurrentBranch, getRepoName, isGitRepo } from '../lib/git.js';
import { getAllhandsRoot, UPSTREAM_REPO } from '../lib/paths.js';

const PROTECTED_BRANCHES = new Set(['main', 'master', 'develop', 'staging', 'production']);

function walkDir(dir: string, callback: (filePath: string) => void): void {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, callback);
    } else if (entry.isFile()) {
      callback(fullPath);
    }
  }
}

function getChangedManagedFiles(
  targetRoot: string,
  allhandsRoot: string,
  manifest: Manifest,
  ignorePatterns: string[]
): string[] {
  const changes: string[] = [];

  for (const relPath of manifest.getDistributableFiles()) {
    if (isIgnored(relPath, ignorePatterns)) continue;

    const sourceFile = join(allhandsRoot, relPath);
    const targetFile = join(targetRoot, relPath);

    if (!existsSync(targetFile)) continue;

    if (!existsSync(sourceFile)) {
      changes.push(relPath);
      continue;
    }

    const sourceContent = readFileSync(sourceFile);
    const targetContent = readFileSync(targetFile);
    if (!sourceContent.equals(targetContent)) {
      changes.push(relPath);
    }
  }

  return changes;
}

function getNewFilesInManagedDirs(
  targetRoot: string,
  allhandsRoot: string,
  manifest: Manifest,
  ignorePatterns: string[]
): string[] {
  const newFiles: string[] = [];

  const claudeDir = join(targetRoot, '.claude');
  if (existsSync(claudeDir)) {
    walkDir(claudeDir, (targetFile) => {
      const relPath = relative(targetRoot, targetFile);

      if (isIgnored(relPath, ignorePatterns)) return;

      const sourceFile = join(allhandsRoot, relPath);
      if (!existsSync(sourceFile) && manifest.isDistributable(relPath)) {
        newFiles.push(relPath);
      }
    });
  }

  return newFiles;
}

function cloneAllhandsToTemp(): string | null {
  const tempDir = join(tmpdir(), `allhands-sync-${Date.now()}`);

  console.log(`Cloning ${UPSTREAM_REPO} to temp directory...`);
  const result = ghCli(['repo', 'clone', UPSTREAM_REPO, tempDir, '--', '--depth=1'], process.cwd());

  if (!result.success) {
    console.error(`Failed to clone: ${result.stderr}`);
    return null;
  }

  return tempDir;
}

function cleanupTempDir(tempDir: string): void {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }
}

export interface SyncBackOptions {
  auto?: boolean;
  list?: boolean;
}

export async function cmdSyncBack(options: SyncBackOptions = {}): Promise<number> {
  const { auto = false, list = false } = options;
  const targetRoot = process.cwd();

  if (!isGitRepo(targetRoot)) {
    if (!list) console.error('Error: Not in a git repository');
    return 1;
  }

  const currentBranch = getCurrentBranch(targetRoot);

  if (!currentBranch) {
    if (auto) return 0;
    if (!list) {
      console.error('Error: Could not determine current branch');
      console.error('Ensure you have at least one commit and are on a branch');
    }
    return 1;
  }

  if (auto && !PROTECTED_BRANCHES.has(currentBranch)) {
    return 0;
  }

  // Get allhands source for comparison (from package or ALLHANDS_PATH)
  const sourceRoot = getAllhandsRoot();

  if (!existsSync(join(sourceRoot, '.allhands-manifest.json'))) {
    if (!list) console.error(`Error: Manifest not found at ${sourceRoot}`);
    return 1;
  }

  const manifest = new Manifest(sourceRoot);
  const ignorePatterns = loadIgnorePatterns(targetRoot);

  // Find changed files
  const changedFiles = getChangedManagedFiles(targetRoot, sourceRoot, manifest, ignorePatterns);
  const newFiles = getNewFilesInManagedDirs(targetRoot, sourceRoot, manifest, ignorePatterns);
  const filesToSync = [...changedFiles, ...newFiles];

  // --list mode: just print files that would sync, one per line
  if (list) {
    for (const f of filesToSync) {
      console.log(f);
    }
    return 0;
  }

  if (filesToSync.length === 0) {
    console.log('No changes to sync back');
    return 0;
  }

  // Check gh auth (only needed for actual sync, not --list)
  const authResult = ghCli(['auth', 'status'], targetRoot);
  if (!authResult.success) {
    console.error('Error: Not authenticated with GitHub CLI');
    console.error('Run: gh auth login');
    return 1;
  }

  const repoName = getRepoName(targetRoot);
  const prBranch = `sync/${repoName}/${currentBranch}`;

  console.log(`\n📋 Syncing ${filesToSync.length} file(s) to ${UPSTREAM_REPO}`);
  console.log(`   Branch: ${prBranch}\n`);

  for (const f of filesToSync) {
    const isNew = newFiles.includes(f);
    console.log(`   ${isNew ? '[NEW]' : '[MOD]'} ${f}`);
  }
  console.log();

  // Always clone to temp directory to avoid conflicts with local staged changes
  const allhandsClone = cloneAllhandsToTemp();
  if (!allhandsClone) {
    return 1;
  }

  try {
    // Fetch latest and checkout/create branch
    git(['fetch', 'origin'], allhandsClone);

    const branchCheck = git(['ls-remote', '--heads', 'origin', prBranch], allhandsClone);
    const branchExists = branchCheck.stdout.includes(prBranch);

    if (branchExists) {
      console.log(`Checking out existing branch: ${prBranch}`);
      git(['checkout', '-B', prBranch, `origin/${prBranch}`], allhandsClone);
    } else {
      console.log(`Creating new branch: ${prBranch}`);
      git(['checkout', '-B', prBranch, 'origin/main'], allhandsClone);
    }

    // Copy files from target to allhands clone
    for (const relPath of filesToSync) {
      const source = join(targetRoot, relPath);
      const dest = join(allhandsClone, relPath);

      if (existsSync(source)) {
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, readFileSync(source));
      }
    }

    // Stage and check for changes
    git(['add', '-A'], allhandsClone);

    const diffResult = git(['diff', '--cached', '--quiet'], allhandsClone);
    if (diffResult.success) {
      console.log('✅ No changes to commit (files already synced)');
      return 0;
    }

    // Commit
    const commitMsg = `sync: ${repoName}/${currentBranch}`;
    git(['commit', '-m', commitMsg], allhandsClone);

    // Push
    console.log(`Pushing to origin/${prBranch}...`);
    const pushResult = git(['push', '-u', 'origin', prBranch], allhandsClone);
    if (!pushResult.success) {
      console.error(`Push failed: ${pushResult.stderr}`);
      return 1;
    }

    // Create or check PR
    const prViewResult = ghCli(['pr', 'view', prBranch, '--repo', UPSTREAM_REPO], allhandsClone);

    if (prViewResult.success) {
      console.log(`\n✅ PR updated: ${prBranch}`);
      // Get PR URL
      const prUrlResult = ghCli(['pr', 'view', prBranch, '--repo', UPSTREAM_REPO, '--json', 'url', '-q', '.url'], allhandsClone);
      if (prUrlResult.success) {
        console.log(`   ${prUrlResult.stdout}`);
      }
    } else {
      // Create new PR
      const fileList = filesToSync.map(f => `- \`${f}\``).join('\n');
      const prBody = `Automated sync-back from target repository.

**Source repo:** ${repoName}
**Branch:** \`${currentBranch}\`
**Files changed:** ${filesToSync.length}

${fileList}`;

      const prCreateResult = ghCli([
        'pr', 'create',
        '--repo', UPSTREAM_REPO,
        '--title', `sync: ${repoName}/${currentBranch}`,
        '--body', prBody,
        '--base', 'main',
        '--head', prBranch,
      ], allhandsClone);

      if (prCreateResult.success) {
        console.log(`\n✅ PR created: ${prCreateResult.stdout}`);
      } else {
        console.error(`\n❌ PR creation failed: ${prCreateResult.stderr}`);
        return auto ? 0 : 1;
      }
    }

    return 0;
  } finally {
    console.log('Cleaning up temp directory...');
    cleanupTempDir(allhandsClone);
  }
}
