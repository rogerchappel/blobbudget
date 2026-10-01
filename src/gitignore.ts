import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { matchesGlob } from './glob.js';

export interface IgnoreRule {
  pattern: string;
  negated: boolean;
}

function gitignorePatternToGlob(pattern: string): string {
  const anchored = pattern.startsWith('/');
  let source = anchored ? pattern.slice(1) : pattern;
  const directoryOnly = source.endsWith('/');
  if (directoryOnly) source = source.slice(0, -1);
  if (!anchored && !source.includes('/')) source = `**/${source}`;
  return directoryOnly ? `${source}/**` : source;
}

export async function readIgnorePatterns(root: string, respectGitignore: boolean, extra: string[]): Promise<IgnoreRule[]> {
  const patterns: IgnoreRule[] = [];
  if (respectGitignore) {
    const gitignorePath = path.join(root, '.gitignore');
    if (existsSync(gitignorePath)) {
      const lines = (await readFile(gitignorePath, 'utf8')).split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const negated = trimmed.startsWith('!');
        const source = negated ? trimmed.slice(1) : trimmed;
        if (!source) continue;
        patterns.push({ pattern: gitignorePatternToGlob(source), negated });
      }
    }
  }
  patterns.push(...extra.map((pattern) => ({ pattern, negated: false })));
  return patterns;
}

export function isIgnored(relativePath: string, patterns: IgnoreRule[]): boolean {
  const segments = relativePath.split('/');
  const candidates = segments.map((_, index) => segments.slice(0, index + 1).join('/'));
  let ignored = false;
  for (const rule of patterns) {
    if (candidates.some((candidate) => matchesGlob(candidate, rule.pattern))) {
      ignored = !rule.negated;
    }
  }
  return ignored;
}
