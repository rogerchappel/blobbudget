import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
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

test('package measurement does not run lifecycle scripts', async () => {
  const root = fixture('package-bloat');
  const marker = `${root}/PACKAGE_SCRIPT_RAN`;
  await rm(marker, { force: true });

  try {
    const report = await scan({ root, respectGitignore: true, includePackagePayload: true });
    await assert.rejects(access(marker));
    assert.equal(report.packagePayload?.source, 'npm-pack-dry-run');
    assert.ok(report.packagePayload?.files.some((file) => file.path === 'payload.bin'));
    assert.ok(report.packagePayload && report.packagePayload.totalBytes > 2 * 1024);
    assert.ok(report.findings.some((item) => item.kind === 'package-payload'));
  } finally {
    await rm(marker, { force: true });
  }
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

test('gitignore negation re-includes a basename after an earlier matching rule', async () => {
  const report = await scan({ root: fixture('gitignore-negation'), respectGitignore: true, includePackagePayload: false });

  assert.deepEqual(report.summary.largestFiles.map((file) => file.path).sort(), [
    '.gitignore',
    'ignored/keep.txt',
    'important.txt'
  ]);
});

test('gitignore negation cannot re-include a descendant while its parent remains ignored', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'blobbudget-gitignore-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'ignored'));
  await writeFile(path.join(root, '.gitignore'), 'ignored/\n!ignored/keep.txt\n');
  await writeFile(path.join(root, 'ignored', 'drop.txt'), 'drop\n');
  await writeFile(path.join(root, 'ignored', 'keep.txt'), 'keep\n');

  const report = await scan({ root, respectGitignore: true, includePackagePayload: false });

  assert.equal(report.summary.fileCount, 1);
  assert.ok(!report.summary.largestFiles.some((file) => file.path === 'ignored/keep.txt'));
  assert.ok(!report.summary.largestFiles.some((file) => file.path === 'ignored/drop.txt'));
});

test('gitignore negation re-includes a child after its parent is re-included', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'blobbudget-gitignore-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'ignored'));
  await writeFile(path.join(root, '.gitignore'), 'ignored/\n!ignored/\nignored/*\n!ignored/keep.txt\n');
  await writeFile(path.join(root, 'ignored', 'drop.txt'), 'drop\n');
  await writeFile(path.join(root, 'ignored', 'keep.txt'), 'keep\n');

  const report = await scan({ root, respectGitignore: true, includePackagePayload: false });

  assert.deepEqual(report.summary.largestFiles.map((file) => file.path).sort(), ['.gitignore', 'ignored/keep.txt']);
});

test('nested gitignore rules use directory-relative scope and ordered negation', async () => {
  const report = await scan({ root: fixture('gitignore-nested'), respectGitignore: true, includePackagePayload: false });

  assert.deepEqual(report.summary.largestFiles.map((file) => file.path).sort(), [
    '.gitignore',
    'nested/.gitignore',
    'nested/deeper/anchored.txt',
    'nested/keep.log',
    'outside/drop.log',
    'root.txt'
  ]);
});
