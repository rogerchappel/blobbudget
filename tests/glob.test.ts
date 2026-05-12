import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesGlob, matchesAny, normalizePath } from '../src/glob.js';

test('normalizePath handles platform separators', () => {
  assert.equal(normalizePath('a\\b/c'), 'a/b/c');
});

test('matchesGlob supports directories and stars', () => {
  assert.equal(matchesGlob('dist/bundle.js', 'dist/**'), true);
  assert.equal(matchesGlob('src/index.ts', 'src/*.ts'), true);
  assert.equal(matchesGlob('src/nested/index.ts', 'src/*.ts'), false);
});

test('matchesAny checks pattern lists', () => {
  assert.equal(matchesAny('assets/photo.png', ['dist/**', 'assets/**']), true);
});
