import assert from 'node:assert/strict';
import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const packageJson = JSON.parse(await (await import('node:fs/promises')).readFile('package.json', 'utf8'));
assert.equal(packageJson.scripts.test, 'node --test dist/tests/*.test.js');
assert.equal(packageJson.scripts.pretest, 'npm run build');

const sourceTests = (await readdir('tests')).filter((file) => file.endsWith('.test.ts'));
assert.ok(sourceTests.length > 0, 'tracked TypeScript test suite exists');
const compiledTests = await readdir('dist/tests');
for (const source of sourceTests) {
  const output = source.replace(/\.test\.ts$/, '.test.js');
  assert.ok(compiledTests.includes(output), `compiled test exists: dist/tests/${output}`);
  await access(join('dist/tests', output));
}
console.log(`Verified ${sourceTests.length} TypeScript test sources compile to npm test's dist/tests/*.test.js glob.`);
