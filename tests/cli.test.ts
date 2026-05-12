import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);

test('cli writes markdown report for clean fixture', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'blobbudget-cli-'));
  const out = path.join(dir, 'report.md');
  const fixture = `${process.cwd()}/fixtures/clean`;
  const { stdout } = await execFileAsync(process.execPath, ['dist/src/cli.js', 'scan', fixture, '--out', out, '--fail-on', 'high'], { cwd: process.cwd() });
  assert.equal(stdout, '');
  assert.match(await readFile(out, 'utf8'), /BlobBudget Report/);
});
