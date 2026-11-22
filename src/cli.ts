#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { initConfig, renderJson, renderMarkdown, scan } from './index.js';
import { severityAtLeast } from './severity.js';
import type { Severity } from './types.js';
import { ConfigError } from './config.js';

interface ParsedArgs {
  version?: boolean;
  command?: string;
  target?: string;
  out?: string;
  format: 'markdown' | 'json';
  failOn?: Severity;
  config?: string;
  preset: string;
  respectGitignore: boolean;
  packagePayload: boolean;
  force: boolean;
  help: boolean;
  error?: string;
  options: Set<string>;
}

const commandOptions: Record<'scan' | 'init', Set<string>> = {
  scan: new Set(['--out', '--format', '--fail-on', '--config', '--no-gitignore', '--no-package']),
  init: new Set(['--preset', '--force'])
};

function usage(): string {
  return `BlobBudget - local repo bloat budget checker\n\nUsage:\n  blobbudget scan [path] [--out file] [--format markdown|json] [--fail-on low|medium|high] [--config file] [--no-gitignore] [--no-package]\n  blobbudget init [--preset node-cli] [--force]\n\nOptions:\n  --out, -o file        Write the scan report to a file\n  --config file          Load a specific config file for a scan\n  --format value        Scan report format: markdown or json\n  --fail-on severity    Scan failure threshold: low, medium, or high\n  --preset value        Init config preset: node-cli\n  --no-gitignore        Do not read .gitignore during a scan\n  --no-package          Skip npm package payload measurement during a scan\n  --force               Overwrite an existing config during init\n  --help                Show this help\n\nValue options accept either --name value or --name=value.\n`;
}

function parse(argv: string[]): ParsedArgs {
  const args: ParsedArgs = { format: 'markdown', preset: 'node-cli', respectGitignore: true, packagePayload: true, force: false, help: false, options: new Set() };
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const rawArg = argv[i];
    const equalsIndex = rawArg?.indexOf('=') ?? -1;
    const arg = equalsIndex > 0 ? rawArg?.slice(0, equalsIndex) : rawArg;
    const inlineValue = equalsIndex > 0 ? rawArg?.slice(equalsIndex + 1) : undefined;
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--version' || arg === '-v') args.version = true;
    else if (arg === '--out' || arg === '-o') { const value = inlineValue ?? readOptionValue(argv, ++i, arg); if (typeof value === 'string' && value) { args.out = value; args.options.add('--out'); } else return { ...args, error: typeof value === 'string' ? `Missing value for ${arg}.` : value.error }; }
    else if (arg === '--format') {
      const value = inlineValue ?? readOptionValue(argv, ++i, arg);
      if (typeof value !== 'string') return { ...args, error: value.error };
      if (value !== 'json' && value !== 'markdown') return { ...args, error: `Invalid --format "${value}". Expected markdown or json.` };
      args.format = value;
      args.options.add('--format');
    }
    else if (arg === '--fail-on') {
      const value = inlineValue ?? readOptionValue(argv, ++i, arg);
      if (typeof value !== 'string') return { ...args, error: value.error };
      if (value !== 'low' && value !== 'medium' && value !== 'high') {
        return { ...args, error: `Invalid --fail-on "${value}". Expected low, medium, or high.` };
      }
      args.failOn = value;
      args.options.add('--fail-on');
    }
    else if (arg === '--config') { const value = inlineValue ?? readOptionValue(argv, ++i, arg); if (typeof value === 'string' && value) { args.config = value; args.options.add('--config'); } else return { ...args, error: typeof value === 'string' ? `Missing value for ${arg}.` : value.error }; }
    else if (arg === '--preset') {
      const value = inlineValue ?? readOptionValue(argv, ++i, arg);
      if (typeof value !== 'string') return { ...args, error: value.error };
      if (value !== 'node-cli') return { ...args, error: `Invalid --preset "${value}". Expected node-cli.` };
      args.preset = value;
      args.options.add('--preset');
    }
    else if (arg === '--no-gitignore') { args.respectGitignore = false; args.options.add('--no-gitignore'); }
    else if (arg === '--no-package') { args.packagePayload = false; args.options.add('--no-package'); }
    else if (arg === '--force') { args.force = true; args.options.add('--force'); }
    else if (arg?.startsWith('-')) return { ...args, error: `Unknown option: ${arg}` };
    else positionals.push(arg ?? '');
  }
  if (positionals[0]) args.command = positionals[0];
  if (positionals[1]) args.target = positionals[1];
  if (args.command === 'scan' && positionals.length > 2) {
    args.error = `Unexpected positional argument "${positionals[2]}" for scan.`;
  }
  if (args.command === 'init' && positionals.length > 1) {
    args.error = `Unexpected positional argument "${positionals[1]}" for init.`;
  }
  if (args.command === 'scan' || args.command === 'init') {
    const unsupported = [...args.options].find((option) => !commandOptions[args.command as 'scan' | 'init'].has(option));
    if (unsupported) args.error = `Option ${unsupported} is not supported by ${args.command}.`;
  }
  return args;
}

function readOptionValue(argv: string[], index: number, flag: string): string | { error: string } {
  const value = argv[index];
  if (!value || value.startsWith('-')) {
    return { error: `Missing value for ${flag}.` };
  }
  return value;
}

async function main(): Promise<number> {
  const args = parse(process.argv.slice(2));
  if (args.error) {
    process.stderr.write(`${args.error}\n\n${usage()}`);
    return 2;
  }
  if (args.version) {
    process.stdout.write("0.1.0\n");
    return 0;
  }
  if (args.help || !args.command) {
    process.stdout.write(usage());
    return 0;
  }
  if (args.command === 'init') {
    const target = await initConfig(process.cwd(), args.preset, args.force);
    process.stdout.write(`Wrote ${path.relative(process.cwd(), target)}\n`);
    return 0;
  }
  if (args.command !== 'scan') {
    process.stderr.write(`Unknown command: ${args.command}\n\n${usage()}`);
    return 2;
  }
  const root = path.resolve(process.cwd(), args.target ?? '.');
  const scanOptions = { root, respectGitignore: args.respectGitignore, includePackagePayload: args.packagePayload, ...(args.config ? { configPath: args.config } : {}), ...(args.failOn ? { failOn: args.failOn } : {}) };
  const report = await scan(scanOptions);
  const output = args.format === 'json' ? renderJson(report) : renderMarkdown(report);
  if (args.out) {
    await mkdir(path.dirname(path.resolve(args.out)), { recursive: true });
    await writeFile(args.out, output);
  } else {
    process.stdout.write(output);
  }
  const threshold = args.failOn ?? report.config.failOn;
  return report.findings.some((item) => severityAtLeast(item.severity, threshold)) ? 1 : 0;
}

main().then((code) => { process.exitCode = code; }).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = error instanceof ConfigError ? 2 : 1;
});
