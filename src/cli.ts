import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { cmdInit } from './commands/init.js';
import { cmdUpdate } from './commands/update.js';
import { cmdSyncBack } from './commands/sync-back.js';
import { cmdCheckIgnored } from './commands/check-ignored.js';
import { checkGitInstalled, checkGhInstalled } from './lib/git.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');
const VERSION = pkg.version;

async function main() {
  // Check dependencies
  if (!checkGitInstalled()) {
    console.error('Error: git is not installed. Please install git first.');
    process.exit(1);
  }

  const argv = await yargs(hideBin(process.argv))
    .scriptName('claude-all-hands')
    .version(VERSION)
    .usage('$0 <command> [options]')
    .command(
      'init <target>',
      'Initialize allhands in target repo',
      (yargs) => {
        return yargs
          .positional('target', {
            describe: 'Target repository path',
            type: 'string',
            demandOption: true,
          })
          .option('yes', {
            alias: 'y',
            type: 'boolean',
            describe: 'Skip confirmation prompts',
            default: false,
          });
      },
      async (argv) => {
        const code = await cmdInit(argv.target as string, argv.yes as boolean);
        process.exit(code);
      }
    )
    .command(
      'update',
      'Pull latest from allhands',
      (yargs) => {
        return yargs.option('yes', {
          alias: 'y',
          type: 'boolean',
          describe: 'Skip confirmation prompts',
          default: false,
        });
      },
      async (argv) => {
        const code = await cmdUpdate(argv.yes as boolean);
        process.exit(code);
      }
    )
    .command(
      'sync-back',
      'Sync changes back to allhands as PR',
      (yargs) => {
        return yargs
          .option('auto', {
            type: 'boolean',
            describe: 'Non-interactive mode (for hooks/CI)',
            default: false,
          })
          .option('list', {
            type: 'boolean',
            describe: 'List files that would sync (no PR created)',
            default: false,
          });
      },
      async (argv) => {
        // gh CLI only needed if not --list mode
        if (!argv.list && !checkGhInstalled()) {
          console.error('Error: GitHub CLI (gh) is not installed. Please install it first.');
          console.error('Visit: https://cli.github.com/');
          process.exit(1);
        }
        const code = await cmdSyncBack({
          auto: argv.auto as boolean,
          list: argv.list as boolean,
        });
        process.exit(code);
      }
    )
    .command(
      'check-ignored [files..]',
      'Filter files through .allhandsignore',
      (yargs) => {
        return yargs.positional('files', {
          describe: 'Files to check',
          type: 'string',
          array: true,
          default: [],
        });
      },
      (argv) => {
        const code = cmdCheckIgnored(argv.files as string[]);
        process.exit(code);
      }
    )
    .demandCommand(1, 'Please specify a command')
    .strict()
    .help()
    .alias('h', 'help')
    .parse();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
