import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { Manifest } from '../lib/manifest.js';
import { isGitRepo, getStagedFiles } from '../lib/git.js';
import { getAllhandsRoot } from '../lib/paths.js';
import * as readline from 'readline';

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} [y/N]: `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

export async function cmdUpdate(autoYes: boolean = false): Promise<number> {
  const targetRoot = process.cwd();

  if (!isGitRepo(targetRoot)) {
    console.error('Error: Not in a git repository');
    return 1;
  }

  const allhandsRoot = getAllhandsRoot();

  if (!existsSync(join(allhandsRoot, '.allhands-manifest.json'))) {
    console.error(`Error: Manifest not found at ${allhandsRoot}`);
    console.error('Set ALLHANDS_PATH to your claude-all-hands directory');
    return 1;
  }

  const manifest = new Manifest(allhandsRoot);

  console.log(`Updating from: ${allhandsRoot}`);
  console.log(`Target: ${targetRoot}`);

  // Check for staged changes to managed files
  const staged = getStagedFiles(targetRoot);
  const distributable = manifest.getDistributableFiles();
  const managedPaths = new Set(distributable);

  const conflicts = [...staged].filter(f => managedPaths.has(f));
  if (conflicts.length > 0) {
    console.error('Error: Staged changes detected in managed files:');
    for (const f of conflicts.sort()) {
      console.error(`  - ${f}`);
    }
    console.error("\nRun 'git stash' or commit first.");
    return 1;
  }

  console.log(`Found ${distributable.size} distributable files`);

  // Check which files will be overwritten
  const willOverwrite: string[] = [];
  const deletedInSource: string[] = [];

  for (const relPath of distributable) {
    const sourceFile = join(allhandsRoot, relPath);
    const targetFile = join(targetRoot, relPath);

    if (!existsSync(sourceFile)) {
      if (existsSync(targetFile)) {
        deletedInSource.push(relPath);
      }
      continue;
    }

    if (existsSync(targetFile)) {
      const sourceContent = readFileSync(sourceFile);
      const targetContent = readFileSync(targetFile);
      if (!sourceContent.equals(targetContent)) {
        willOverwrite.push(relPath);
      }
    }
  }

  // Warn about overwrites
  if (willOverwrite.length > 0) {
    console.log(`\n${'!'.repeat(60)}`);
    console.log('WARNING: The following files will be OVERWRITTEN:');
    console.log(`${'!'.repeat(60)}`);
    for (const f of willOverwrite.sort()) {
      console.log(`  → ${f}`);
    }
    console.log();

    if (!autoYes) {
      if (!(await confirm('Continue and overwrite these files?'))) {
        console.log('Aborted. No changes made.');
        return 1;
      }
    }
  }

  // Copy updated files
  let updated = 0;
  let created = 0;

  for (const relPath of [...distributable].sort()) {
    const sourceFile = join(allhandsRoot, relPath);
    const targetFile = join(targetRoot, relPath);

    if (!existsSync(sourceFile)) continue;

    mkdirSync(dirname(targetFile), { recursive: true });

    if (existsSync(targetFile)) {
      const sourceContent = readFileSync(sourceFile);
      const targetContent = readFileSync(targetFile);
      if (!sourceContent.equals(targetContent)) {
        copyFileSync(sourceFile, targetFile);
        updated++;
      }
    } else {
      copyFileSync(sourceFile, targetFile);
      created++;
    }
  }

  // Handle deleted files
  if (deletedInSource.length > 0) {
    console.log(`\n${deletedInSource.length} files removed from allhands source:`);
    for (const f of deletedInSource) {
      console.log(`  - ${f}`);
    }
    const shouldDelete = autoYes || (await confirm('Delete these from target?'));
    if (shouldDelete) {
      for (const f of deletedInSource) {
        const targetFile = join(targetRoot, f);
        if (existsSync(targetFile)) {
          unlinkSync(targetFile);
          console.log(`  Deleted: ${f}`);
        }
      }
    }
  }

  console.log(`\nUpdated: ${updated}, Created: ${created}`);
  console.log('\nUpdate complete!');
  console.log('\nNote: Project-specific files preserved:');
  console.log('  - CLAUDE.project.md');
  console.log('  - .claude/settings.local.json');
  console.log('  - .husky/project/*');

  return 0;
}
