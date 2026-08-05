import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
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

test('cli rejects a second scan path without writing a report', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'blobbudget-cli-'));
  const out = path.join(dir, 'report.md');
  await assert.rejects(
    execFileAsync(process.execPath, ['dist/src/cli.js', 'scan', 'fixtures/clean', 'fixtures/heavy', '--out', out, '--no-package'], { cwd: process.cwd() }),
    (error: unknown) => {
      const failure = error as { code?: number; stderr?: string };
      assert.equal(failure.code, 2);
      assert.match(failure.stderr ?? '', /Unexpected positional argument "fixtures\/heavy" for scan\./);
      assert.match(failure.stderr ?? '', /Usage:/);
      return true;
    }
  );
  await assert.rejects(access(out));
});

test('cli rejects an init path without writing a config', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'blobbudget-cli-'));
  await assert.rejects(
    execFileAsync(process.execPath, [path.join(process.cwd(), 'dist/src/cli.js'), 'init', 'nested', '--force'], { cwd: dir }),
    (error: unknown) => {
      const failure = error as { code?: number; stderr?: string };
      assert.equal(failure.code, 2);
      assert.match(failure.stderr ?? '', /Unexpected positional argument "nested" for init\./);
      assert.match(failure.stderr ?? '', /Usage:/);
      return true;
    }
  );
  await assert.rejects(access(path.join(dir, '.blobbudget.json')));
});

for (const args of [
  ['init', '--format', 'json'],
  ['init', '--format=json']
]) {
  test(`cli rejects scan-only ${args.slice(1).join(' ')} during init without writing a config`, async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'blobbudget-cli-'));
    await assert.rejects(
      execFileAsync(process.execPath, [path.join(process.cwd(), 'dist/src/cli.js'), ...args], { cwd: dir }),
      (error: unknown) => {
        const failure = error as { code?: number; stdout?: string; stderr?: string };
        assert.equal(failure.code, 2);
        assert.equal(failure.stdout, '');
        assert.match(failure.stderr ?? '', /Option --format is not supported by init\./);
        assert.match(failure.stderr ?? '', /Usage:/);
        return true;
      }
    );
    await assert.rejects(access(path.join(dir, '.blobbudget.json')));
  });
}

for (const args of [
  ['scan', 'fixtures/clean', '--preset', 'node-cli', '--out', 'report.md'],
  ['scan', 'fixtures/clean', '--preset=node-cli', '--out=report.md']
]) {
  test(`cli rejects init-only ${args[2]} during scan without writing a report`, async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'blobbudget-cli-'));
    await assert.rejects(
      execFileAsync(process.execPath, [path.join(process.cwd(), 'dist/src/cli.js'), ...args], { cwd: dir }),
      (error: unknown) => {
        const failure = error as { code?: number; stdout?: string; stderr?: string };
        assert.equal(failure.code, 2);
        assert.equal(failure.stdout, '');
        assert.match(failure.stderr ?? '', /Option --preset is not supported by scan\./);
        assert.match(failure.stderr ?? '', /Usage:/);
        return true;
      }
    );
    await assert.rejects(access(path.join(dir, 'report.md')));
  });
}

test('cli accepts equals-sign scan value options', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'blobbudget-cli-'));
  const out = path.join(dir, 'report.json');
  await execFileAsync(process.execPath, ['dist/src/cli.js', 'scan', 'fixtures/clean', `--out=${out}`, '--format=json', '--fail-on=high', '--no-package'], { cwd: process.cwd() });
  assert.match(await readFile(out, 'utf8'), /"summary"/);
});

test('cli reports an explicitly requested missing config as a config usage error', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, ['dist/src/cli.js', 'scan', 'fixtures/clean', '--config', 'missing.json', '--no-package'], { cwd: process.cwd() }),
    (error: unknown) => {
      const failure = error as { code?: number; stdout?: string; stderr?: string };
      assert.equal(failure.code, 2);
      assert.equal(failure.stdout, '');
      assert.match(failure.stderr ?? '', /Config file not found:/);
      return true;
    }
  );
});

test('cli still scans with defaults when the implicit config is absent', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'blobbudget-cli-'));
  await writeFile(path.join(root, 'small.txt'), 'ok');
  const { stdout, stderr } = await execFileAsync(process.execPath, [path.join(process.cwd(), 'dist/src/cli.js'), 'scan', root, '--no-package', '--fail-on', 'high'], { cwd: process.cwd() });
  assert.match(stdout, /BlobBudget Report/);
  assert.equal(stderr, '');
});
