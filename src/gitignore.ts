import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { matchesGlob } from './glob.js';

export interface IgnoreRule {
  pattern: string;
  negated: boolean;
  source: 'gitignore' | 'config';
}

function gitignorePatternToGlob(pattern: string, directory: string): string {
  const anchored = pattern.startsWith('/');
  let source = anchored ? pattern.slice(1) : pattern;
  const directoryOnly = source.endsWith('/');
  if (directoryOnly) source = source.slice(0, -1);
  if (!anchored && !source.includes('/')) source = `**/${source}`;
  if (directory) source = `${directory}/${source}`;
  return directoryOnly ? `${source}/**` : source;
}

export async function readGitignorePatterns(root: string, directory = ''): Promise<IgnoreRule[]> {
  const gitignorePath = path.join(root, directory, '.gitignore');
  if (!existsSync(gitignorePath)) return [];
  const patterns: IgnoreRule[] = [];
  const lines = (await readFile(gitignorePath, 'utf8')).split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const negated = trimmed.startsWith('!');
    const source = negated ? trimmed.slice(1) : trimmed;
    if (!source) continue;
    patterns.push({ pattern: gitignorePatternToGlob(source, directory), negated, source: 'gitignore' });
  }
  return patterns;
}

export async function readIgnorePatterns(root: string, respectGitignore: boolean, extra: string[]): Promise<IgnoreRule[]> {
  const patterns = respectGitignore ? await readGitignorePatterns(root) : [];
  patterns.push(...extra.map((pattern) => ({ pattern, negated: false, source: 'config' as const })));
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
