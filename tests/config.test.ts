import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBytes, formatBytes } from '../src/bytes.js';
import { loadConfig } from '../src/config.js';

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
