#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { access, readFile, rm } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = new URL('..', import.meta.url).pathname;
const report = new URL('../blobbudget.md', import.meta.url);
const documentedCommand = 'node dist/src/cli.js scan . --out blobbudget.md --fail-on medium';

for (const file of ['README.md', 'examples/github-actions.yml']) {
  const contents = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  if (!contents.includes(documentedCommand)) {
    throw new Error(`${file} must document the executable local CI command: ${documentedCommand}`);
  }
}

try {
  await access(report);
  throw new Error('refusing to overwrite an existing blobbudget.md while checking documentation');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

try {
  await execFileAsync(process.execPath, documentedCommand.split(' ').slice(1), { cwd: root });
  const contents = await readFile(report, 'utf8');
  if (!contents.includes('# BlobBudget Report')) {
    throw new Error('documented local CI command did not produce the expected report');
  }
} finally {
  await rm(report, { force: true });
}

console.log('Documented local CI command produced a BlobBudget report.');
