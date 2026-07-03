#!/usr/bin/env node
// npx @hypermedia-components/cli add <recipe> [--dir <target>] [--force]
// npx @hypermedia-components/cli list
// npx @hypermedia-components/cli validate <paths…> [--recipe <name>] [--strict]
import { parseArgs } from 'node:util';
import { listRecipes, copyRecipe, RECIPE_FILES } from '../lib/recipes.mjs';

const USAGE = `Usage:
  hypermedia-components add <recipe> [--dir <target>] [--force]
  hypermedia-components list
  hypermedia-components validate <file|dir>… [--recipe <name>] [--strict]

Commands:
  add       Copy a recipe's source files (${RECIPE_FILES.join(' / ')})
            into <target>/<recipe>/ (target defaults to the current directory).
  list      Show the available recipes.
  validate  Check local HTML against the recipes' machine-readable
            contracts (recipes/<name>/checks.json). Detects recipe
            instances automatically; exits 1 on contract errors.

Options:
  -d, --dir <target>   add: directory to copy into (default: ".")
  -f, --force          add: overwrite existing files
  -r, --recipe <name>  validate: check one recipe (must be detected)
  -s, --strict         validate: treat warnings as errors
  -h, --help           Show this help
`;

async function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      dir: { type: 'string', short: 'd', default: '.' },
      force: { type: 'boolean', short: 'f', default: false },
      recipe: { type: 'string', short: 'r' },
      strict: { type: 'boolean', short: 's', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  const [command, name] = positionals;

  if (values.help || !command || command === 'help') {
    process.stdout.write(USAGE);
    return 0;
  }

  if (command === 'list') {
    for (const recipe of await listRecipes()) {
      process.stdout.write(`${recipe.name.padEnd(18)} ${recipe.purpose}\n`);
    }
    return 0;
  }

  if (command === 'add') {
    if (!name) {
      process.stderr.write(`Missing recipe name.\n\n${USAGE}`);
      return 1;
    }
    const written = await copyRecipe(name, values.dir, { force: values.force });
    for (const file of written) process.stdout.write(`${file}\n`);
    process.stdout.write(
      `\nCopied ${written.length} files. recipe.html is the starting point; ` +
        `contract.md documents the server responses it expects.\n`,
    );
    return 0;
  }

  if (command === 'validate') {
    // linkedom (the HTML parser) loads only on this path — `add` and
    // `list` stay dependency-free at run time.
    const { runValidate } = await import('../lib/validate.mjs');
    return runValidate(positionals.slice(1), {
      recipe: values.recipe,
      strict: values.strict,
      stdout: (s) => process.stdout.write(s),
      stderr: (s) => process.stderr.write(s),
    });
  }

  process.stderr.write(`Unknown command ${JSON.stringify(command)}.\n\n${USAGE}`);
  return 1;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(error.message.startsWith('Refusing to overwrite') ? 2 : 1);
  },
);
