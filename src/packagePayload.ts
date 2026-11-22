import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type { FileEntry, PackagePayloadSummary } from './types.js';

const execFileAsync = promisify(execFile);

export async function measurePackagePayload(root: string, fallbackFiles: FileEntry[]): Promise<PackagePayloadSummary> {
  try {
    const { stdout } = await execFileAsync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, timeout: 20_000, maxBuffer: 1024 * 1024 });
    const parsed = JSON.parse(stdout) as Array<{ files?: Array<{ path: string; size: number }>; size?: number }>;
    const pack = parsed[0];
    const files = (pack?.files ?? []).map((file) => ({ path: file.path, size: file.size })).sort((a, b) => a.path.localeCompare(b.path));
    return { files, totalBytes: files.reduce((sum, file) => sum + file.size, 0), source: 'npm-pack-dry-run' };
  } catch {
    const files = fallbackFiles
      .filter((file) => !file.path.startsWith('.git/') && !file.path.startsWith('node_modules/'))
      .map((file) => ({ path: path.posix.normalize(file.path), size: file.size }))
      .sort((a, b) => a.path.localeCompare(b.path));
    return { files, totalBytes: files.reduce((sum, file) => sum + file.size, 0), source: 'working-tree-estimate' };
  }
}
