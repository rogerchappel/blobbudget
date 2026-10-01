import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { matchesAny } from './glob.js';

function gitignorePatternToGlob(pattern: string): string {
  const anchored = pattern.startsWith('/');
  let source = anchored ? pattern.slice(1) : pattern;
  const directoryOnly = source.endsWith('/');
  if (directoryOnly) source = source.slice(0, -1);
  if (!anchored && !source.includes('/')) source = `**/${source}`;
  return directoryOnly ? `${source}/**` : source;
}

export async function readIgnorePatterns(root: string, respectGitignore: boolean, extra: string[]): Promise<string[]> {
  const patterns = [...extra];
  if (respectGitignore) {
    const gitignorePath = path.join(root, '.gitignore');
    if (existsSync(gitignorePath)) {
      const lines = (await readFile(gitignorePath, 'utf8')).split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue;
        patterns.push(gitignorePatternToGlob(trimmed));
      }
    }
  }
  return Array.from(new Set(patterns));
}

export function isIgnored(relativePath: string, patterns: string[]): boolean {
  return matchesAny(relativePath, patterns);
}
