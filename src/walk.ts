import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { isIgnored, type IgnoreRule } from './gitignore.js';
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

export async function walkFiles(root: string, ignorePatterns: IgnoreRule[]): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];
  async function visit(directory: string): Promise<void> {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      const absolutePath = path.join(directory, child.name);
      const relativePath = normalizePath(path.relative(root, absolutePath));
      if (child.isSymbolicLink()) continue;
      if (child.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (!child.isFile()) continue;
      if (isIgnored(relativePath, ignorePatterns)) continue;
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
  await visit(root);
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}
