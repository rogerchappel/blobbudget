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
}

function usage(): string {
  return `BlobBudget - local repo bloat budget checker\n\nUsage:\n  blobbudget scan [path] [--out file] [--format markdown|json] [--fail-on low|medium|high]\n  blobbudget init [--preset node-cli] [--force]\n\nOptions:\n  --config file          Load a specific config file\n  --format value        Report format: markdown or json\n  --fail-on severity    Failure threshold: low, medium, or high\n  --preset value        Config preset: node-cli\n  --no-gitignore        Do not read .gitignore\n  --no-package          Skip npm package payload measurement\n  --help                Show this help\n`;
}

function parse(argv: string[]): ParsedArgs {
  const args: ParsedArgs = { format: 'markdown', preset: 'node-cli', respectGitignore: true, packagePayload: true, force: false, help: false };
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--version' || arg === '-v') args.version = true;
    else if (arg === '--out' || arg === '-o') { const value = readOptionValue(argv, ++i, arg); if (typeof value === 'string') args.out = value; else return { ...args, error: value.error }; }
    else if (arg === '--format') {
      const value = readOptionValue(argv, ++i, arg);
      if (typeof value !== 'string') return { ...args, error: value.error };
      if (value !== 'json' && value !== 'markdown') return { ...args, error: `Invalid --format "${value}". Expected markdown or json.` };
      args.format = value;
    }
    else if (arg === '--fail-on') {
      const value = readOptionValue(argv, ++i, arg);
      if (typeof value !== 'string') return { ...args, error: value.error };
      if (value !== 'low' && value !== 'medium' && value !== 'high') {
        return { ...args, error: `Invalid --fail-on "${value}". Expected low, medium, or high.` };
      }
      args.failOn = value;
    }
    else if (arg === '--config') { const value = readOptionValue(argv, ++i, arg); if (typeof value === 'string') args.config = value; else return { ...args, error: value.error }; }
    else if (arg === '--preset') {
      const value = readOptionValue(argv, ++i, arg);
      if (typeof value !== 'string') return { ...args, error: value.error };
      if (value !== 'node-cli') return { ...args, error: `Invalid --preset "${value}". Expected node-cli.` };
      args.preset = value;
    }
    else if (arg === '--no-gitignore') args.respectGitignore = false;
    else if (arg === '--no-package') args.packagePayload = false;
    else if (arg === '--force') args.force = true;
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
