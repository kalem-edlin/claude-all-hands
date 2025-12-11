import { loadIgnorePatterns, isIgnored } from '../lib/manifest.js';

export function cmdCheckIgnored(files: string[]): number {
  const patterns = loadIgnorePatterns(process.cwd());

  for (const f of files) {
    if (!isIgnored(f, patterns)) {
      console.log(f);
    }
  }

  return 0;
}
