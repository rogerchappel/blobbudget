import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseBytes, formatBytes } from '../src/bytes.js';
import { configTemplate, loadConfig } from '../src/config.js';

test('parseBytes supports human units', () => {
  assert.equal(parseBytes('1 KiB'), 1024);
  assert.equal(parseBytes('1.5mb'), 1572864);
  assert.equal(parseBytes(42), 42);
});

test('formatBytes emits readable sizes', () => {
  assert.equal(formatBytes(10), '10 B');
  assert.match(formatBytes(1536), /KiB/);
});

test('loadConfig merges checked-in fixture config', async () => {
  const config = await loadConfig(`${process.cwd()}/fixtures/heavy`);
  assert.equal(config.maxFileBytes, 1024);
  assert.equal(config.failOn, 'medium');
});

test('loadConfig uses defaults when the implicit config is absent', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'blobbudget-config-'));
  const config = await loadConfig(root);
  assert.equal(config.maxFileBytes, 512 * 1024);
});

test('loadConfig rejects an explicitly requested missing config', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'blobbudget-config-'));
  await assert.rejects(loadConfig(root, 'missing.json'), /Config file not found:/);
});

test('loadConfig rejects malformed JSON and invalid budget values', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'blobbudget-config-'));
  await writeFile(path.join(root, 'malformed.json'), '{');
  await assert.rejects(loadConfig(root, 'malformed.json'), /Unable to read config/);

  await writeFile(path.join(root, 'invalid.json'), JSON.stringify({
    maxFileBytes: 'unlimited',
    pathBudgets: [{ pattern: 'fixtures/**', maxBytes: 0 }]
  }));
  await assert.rejects(loadConfig(root, 'invalid.json'), /maxFileBytes must be a positive byte value/);
});

test('loadConfig rejects invalid severities and list shapes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'blobbudget-config-'));
  await writeFile(path.join(root, 'invalid.json'), JSON.stringify({ failOn: 'critical' }));
  await assert.rejects(loadConfig(root, 'invalid.json'), /failOn must be low, medium, or high/);

  await writeFile(path.join(root, 'invalid.json'), JSON.stringify({ ignore: ['dist/**', 42] }));
  await assert.rejects(loadConfig(root, 'invalid.json'), /ignore must be an array of strings/);
});

test('loadConfig rejects unknown top-level fields', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'blobbudget-config-'));
  await writeFile(path.join(root, 'invalid.json'), JSON.stringify({ maxFileBytse: 1024 }));
  await assert.rejects(loadConfig(root, 'invalid.json'), /Unknown configuration field: maxFileBytse/);
});

test('loadConfig rejects blank string list entries with their field and index', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'blobbudget-config-'));
  for (const field of ['ignore', 'generatedPatterns', 'suspiciousExtensions']) {
    await writeFile(path.join(root, 'invalid.json'), JSON.stringify({ [field]: ['valid', '  '] }));
    await assert.rejects(loadConfig(root, 'invalid.json'), new RegExp(`${field}\\[1\\] must be a non-empty string`));
  }
});

test('loadConfig accepts checked-in configs and generated presets', async () => {
  const roots = ['.', 'fixtures/clean', 'fixtures/duplicate', 'fixtures/heavy', 'fixtures/package-bloat'];
  for (const root of roots) await loadConfig(path.resolve(root));

  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'blobbudget-config-'));
  await writeFile(path.join(temporaryRoot, 'preset.json'), configTemplate());
  await loadConfig(temporaryRoot, 'preset.json');
  await loadConfig(process.cwd(), 'examples/node-cli.blobbudget.json');
});
