import path from 'node:path';
import { loadConfig } from './config.js';
import { readIgnorePatterns } from './gitignore.js';
import { measurePackagePayload } from './packagePayload.js';
import { walkFiles } from './walk.js';
import { emptySeverityCounts } from './severity.js';
import { detectBinaryExtensions, detectDirectoryBudgets, detectDuplicates, detectExtensionBudgets, detectGeneratedArtifacts, detectLargeFiles, detectPackagePayload, detectPathBudgets, sortFindings } from './detectors.js';
import type { ScanOptions, ScanReport } from './types.js';

export async function scan(options: ScanOptions): Promise<ScanReport> {
  const root = path.resolve(options.root);
  const config = await loadConfig(root, options.configPath);
  if (options.failOn) config.failOn = options.failOn;
  const ignorePatterns = await readIgnorePatterns(root, options.respectGitignore, config.ignore);
  const files = await walkFiles(root, ignorePatterns);
  const payload = options.includePackagePayload ? await measurePackagePayload(root, files) : undefined;
  const findings = sortFindings([
    ...detectLargeFiles(files, config),
    ...detectBinaryExtensions(files, config),
    ...detectGeneratedArtifacts(files, config),
    ...detectDuplicates(files),
    ...detectDirectoryBudgets(files, config),
    ...detectPathBudgets(files, config),
    ...detectExtensionBudgets(files, config),
    ...(payload ? detectPackagePayload(payload, config) : [])
  ]);
  const bySeverity = emptySeverityCounts();
  for (const item of findings) bySeverity[item.severity] += 1;
  return {
    summary: {
      root,
      scannedAt: new Date(0).toISOString(),
      fileCount: files.length,
      totalBytes: files.reduce((sum, file) => sum + file.size, 0),
      findingCount: findings.length,
      bySeverity,
      largestFiles: files.slice().sort((a, b) => b.size - a.size || a.path.localeCompare(b.path)).slice(0, 10).map((file) => ({ path: file.path, size: file.size, extension: file.extension }))
    },
    config,
    findings,
    ...(payload ? { packagePayload: payload } : {})
  };
}
