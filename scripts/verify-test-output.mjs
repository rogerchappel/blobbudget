import assert from 'node:assert/strict';
import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const packageJson = JSON.parse(await (await import('node:fs/promises')).readFile('package.json', 'utf8'));
assert.equal(packageJson.scripts.test, 'node --test dist/tests/*.test.js');
assert.equal(packageJson.scripts.pretest, 'npm run build');

const sourceTests = (await readdir('tests', { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
  .map((entry) => entry.name)
  .sort();
assert.ok(sourceTests.length > 0, 'tracked TypeScript test suite exists');
const compiledTests = (await readdir('dist/tests', { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js'))
  .map((entry) => entry.name);
for (const source of sourceTests) {
  const output = source.replace(/\.test\.ts$/, '.test.js');
  assert.ok(compiledTests.includes(output), `compiled test exists: dist/tests/${output}`);
  await access(join('dist/tests', output));
}
console.log(`Verified ${sourceTests.length} top-level TypeScript test sources compile to npm test's dist/tests/*.test.js glob.`);
