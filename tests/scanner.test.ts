import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { scan } from '../src/scanner.js';

const fixture = (name: string) => `${process.cwd()}/fixtures/${name}`;

test('clean fixture has no medium or high findings', async () => {
  const report = await scan({ root: fixture('clean'), respectGitignore: true, includePackagePayload: true });
  assert.equal(report.findings.filter((item) => item.severity !== 'low').length, 0);
});

test('heavy fixture reports large files and generated output', async () => {
  const report = await scan({ root: fixture('heavy'), respectGitignore: false, includePackagePayload: false });
  assert.ok(report.findings.some((item) => item.kind === 'large-file'));
  assert.ok(report.findings.some((item) => item.kind === 'generated-artifact'));
  assert.ok(report.findings.some((item) => item.kind === 'binary-extension'));
});

test('duplicate fixture reports duplicate blobs', async () => {
  const report = await scan({ root: fixture('duplicate'), respectGitignore: true, includePackagePayload: false });
  const duplicate = report.findings.find((item) => item.kind === 'duplicate-blob');
  assert.ok(duplicate);
  assert.deepEqual(duplicate.relatedPaths, ['a/copy.txt', 'b/copy.txt']);
});

test('package fixture reports package payload budget', async () => {
  const report = await scan({ root: fixture('package-bloat'), respectGitignore: true, includePackagePayload: true });
  assert.ok(report.findings.some((item) => item.kind === 'package-payload'));
});

test('gitignore basename patterns exclude matching files at any depth', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'blobbudget-gitignore-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'nested'));
  await writeFile(path.join(root, '.gitignore'), '*.log\n');
  await writeFile(path.join(root, 'nested', 'debug.log'), 'ignored\n');
  await writeFile(path.join(root, 'nested', 'keep.txt'), 'included\n');

  const report = await scan({ root, respectGitignore: true, includePackagePayload: false });

  assert.deepEqual(report.summary.largestFiles.map((file) => file.path).sort(), ['.gitignore', 'nested/keep.txt']);
});

test('gitignore leading-slash directory patterns exclude only the root directory', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'blobbudget-gitignore-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'dist'));
  await mkdir(path.join(root, 'nested', 'dist'), { recursive: true });
  await writeFile(path.join(root, '.gitignore'), '/dist/\n');
  await writeFile(path.join(root, 'dist', 'bundle.js'), 'ignored\n');
  await writeFile(path.join(root, 'nested', 'dist', 'bundle.js'), 'included\n');

  const report = await scan({ root, respectGitignore: true, includePackagePayload: false });

  assert.deepEqual(report.summary.largestFiles.map((file) => file.path).sort(), ['.gitignore', 'nested/dist/bundle.js']);
});
