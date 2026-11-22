import assert from 'node:assert/strict';
import test from 'node:test';
import { renderJson } from '../src/reportJson.js';
import { renderMarkdown } from '../src/reportMarkdown.js';
import { scan } from '../src/scanner.js';

test('renderers include stable report fields', async () => {
  const report = await scan({ root: `${process.cwd()}/fixtures/heavy`, respectGitignore: false, includePackagePayload: false });
  const json = JSON.parse(renderJson(report));
  assert.equal(json.summary.scannedAt, report.summary.scannedAt);
  assert.ok(Number.isFinite(Date.parse(json.summary.scannedAt)));
  const markdown = renderMarkdown(report);
  assert.match(markdown, /# BlobBudget Report/);
  assert.match(markdown, /large-file/);
});
