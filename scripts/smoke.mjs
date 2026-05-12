#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = new URL('..', import.meta.url).pathname;
const outDir = await mkdtemp(path.join(tmpdir(), 'blobbudget-smoke-'));
const cleanReport = path.join(outDir, 'clean.md');
await execFileAsync(process.execPath, ['dist/src/cli.js', 'scan', 'fixtures/clean', '--out', cleanReport, '--fail-on', 'high'], { cwd: root });
const clean = await readFile(cleanReport, 'utf8');
if (!clean.includes('BlobBudget Report')) throw new Error('markdown smoke report missing title');

let failed = false;
try {
  await execFileAsync(process.execPath, ['dist/src/cli.js', 'scan', 'fixtures/heavy', '--format', 'json', '--fail-on', 'medium', '--no-package'], { cwd: root });
} catch (error) {
  failed = true;
  const stdout = error && typeof error === 'object' && 'stdout' in error ? String(error.stdout) : '';
  const parsed = JSON.parse(stdout);
  if (!parsed.findings.some((item) => item.kind === 'large-file')) throw new Error('heavy smoke missed large-file finding');
}
if (!failed) throw new Error('heavy fixture should fail at medium threshold');
console.log(`Smoke reports written under ${outDir}`);
