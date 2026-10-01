import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile } from 'node:fs/promises';
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

test('cli rejects invalid format values instead of silently using markdown', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, ['dist/src/cli.js', 'scan', 'fixtures/clean', '--format', 'xml'], { cwd: process.cwd() }),
    (error: unknown) => {
      const failure = error as { code?: number; stderr?: string };
      assert.equal(failure.code, 2);
      assert.match(failure.stderr ?? '', /Invalid --format "xml"/);
      return true;
    }
  );
});

test('cli rejects unsupported fail-on severities', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, ['dist/src/cli.js', 'scan', 'fixtures/clean', '--fail-on', 'critical'], { cwd: process.cwd() }),
    (error: unknown) => {
      const failure = error as { code?: number; stderr?: string };
      assert.equal(failure.code, 2);
      assert.match(failure.stderr ?? '', /Invalid --fail-on "critical". Expected low, medium, or high\./);
      assert.match(failure.stderr ?? '', /Usage:/);
      return true;
    }
  );
});

test('cli rejects unknown options', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, ['dist/src/cli.js', 'scan', 'fixtures/clean', '--bogus'], { cwd: process.cwd() }),
    (error: unknown) => {
      const failure = error as { code?: number; stderr?: string };
      assert.equal(failure.code, 2);
      assert.match(failure.stderr ?? '', /Unknown option: --bogus/);
      assert.match(failure.stderr ?? '', /Usage:/);
      return true;
    }
  );
});

test('cli rejects unsupported init presets without writing a config', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'blobbudget-cli-'));
  await assert.rejects(
    execFileAsync(process.execPath, [path.join(process.cwd(), 'dist/src/cli.js'), 'init', '--preset', 'python'], { cwd: dir }),
    (error: unknown) => {
      const failure = error as { code?: number; stderr?: string };
      assert.equal(failure.code, 2);
      assert.match(failure.stderr ?? '', /Invalid --preset "python". Expected node-cli\./);
      assert.match(failure.stderr ?? '', /Usage:/);
      return true;
    }
  );
  await assert.rejects(access(path.join(dir, '.blobbudget.json')));
});
