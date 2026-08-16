import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { isIgnored, readGitignorePatterns, type IgnoreRule } from './gitignore.js';
import { normalizePath } from './glob.js';
import type { FileEntry } from './types.js';

function isProbablyBinary(buffer: Buffer): boolean {
  if (buffer.includes(0)) return true;
  let suspicious = 0;
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  for (const byte of sample) {
    if (byte < 7 || (byte > 14 && byte < 32)) suspicious += 1;
  }
  return sample.length > 0 && suspicious / sample.length > 0.08;
}

export async function walkFiles(root: string, ignorePatterns: IgnoreRule[], respectGitignore = true): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];
  async function visit(directory: string, inheritedPatterns: IgnoreRule[]): Promise<void> {
    const relativeDirectory = normalizePath(path.relative(root, directory));
    const nestedPatterns = respectGitignore && relativeDirectory
      ? await readGitignorePatterns(root, relativeDirectory)
      : [];
    const firstConfigRule = inheritedPatterns.findIndex((rule) => rule.source === 'config');
    const insertionPoint = firstConfigRule === -1 ? inheritedPatterns.length : firstConfigRule;
    const patterns = [
      ...inheritedPatterns.slice(0, insertionPoint),
      ...nestedPatterns,
      ...inheritedPatterns.slice(insertionPoint)
    ];
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      const absolutePath = path.join(directory, child.name);
      const relativePath = normalizePath(path.relative(root, absolutePath));
      if (child.isSymbolicLink()) continue;
      if (child.isDirectory()) {
        await visit(absolutePath, patterns);
        continue;
      }
      if (!child.isFile()) continue;
      if (isIgnored(relativePath, patterns)) continue;
      const info = await stat(absolutePath);
      const buffer = await readFile(absolutePath);
      entries.push({
        path: relativePath,
        absolutePath,
        size: info.size,
        extension: path.extname(child.name).toLowerCase(),
        hash: createHash('sha256').update(buffer).digest('hex'),
        isBinary: isProbablyBinary(buffer)
      });
    }
  }
  await visit(root, ignorePatterns);
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}
