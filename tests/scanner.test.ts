import assert from 'node:assert/strict';
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
