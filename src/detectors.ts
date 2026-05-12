import path from 'node:path';
import { matchesGlob } from './glob.js';
import { severityForRatio } from './severity.js';
import type { BlobBudgetConfig, FileEntry, Finding, PackagePayloadSummary } from './types.js';

function finding(kind: Finding['kind'], pathName: string, size: number, budget: number | undefined, severity: Finding['severity'], message: string, suggestion: string, relatedPaths?: string[]): Finding {
  return { kind, path: pathName, size, severity, message, suggestion, ...(budget === undefined ? {} : { budget }), ...(relatedPaths && relatedPaths.length ? { relatedPaths } : {}) };
}

export function detectLargeFiles(files: FileEntry[], config: BlobBudgetConfig): Finding[] {
  return files
    .filter((file) => file.size > config.maxFileBytes)
    .map((file) => finding('large-file', file.path, file.size, config.maxFileBytes, severityForRatio(file.size, config.maxFileBytes), `${file.path} exceeds the per-file budget.`, 'Move bulky content to release artifacts, compress fixtures, or add a narrower path budget if intentional.'));
}

export function detectBinaryExtensions(files: FileEntry[], config: BlobBudgetConfig): Finding[] {
  return files
    .filter((file) => config.suspiciousExtensions.includes(file.extension))
    .map((file) => finding('binary-extension', file.path, file.size, undefined, file.isBinary ? 'medium' : 'low', `${file.path} uses a suspicious binary/archive extension.`, 'Confirm the asset is required; prefer generated-at-test-time fixtures or externally hosted release assets.'));
}

export function detectGeneratedArtifacts(files: FileEntry[], config: BlobBudgetConfig): Finding[] {
  return files
    .filter((file) => config.generatedPatterns.some((pattern) => matchesGlob(file.path, pattern)))
    .map((file) => finding('generated-artifact', file.path, file.size, undefined, 'medium', `${file.path} looks like generated output.`, 'Keep build output out of source control unless this repository intentionally ships generated files.'));
}

export function detectDuplicates(files: FileEntry[]): Finding[] {
  const byHash = new Map<string, FileEntry[]>();
  for (const file of files) {
    if (file.size === 0) continue;
    const existing = byHash.get(file.hash) ?? [];
    existing.push(file);
    byHash.set(file.hash, existing);
  }
  const findings: Finding[] = [];
  for (const group of byHash.values()) {
    if (group.length < 2) continue;
    const sorted = group.sort((a, b) => a.path.localeCompare(b.path));
    const duplicateBytes = sorted.slice(1).reduce((sum, file) => sum + file.size, 0);
    findings.push(finding('duplicate-blob', sorted[0]!.path, duplicateBytes, undefined, duplicateBytes > 256 * 1024 ? 'medium' : 'low', `${sorted.length} files share identical content.`, 'Deduplicate fixtures or keep one canonical copy referenced by tests.', sorted.map((file) => file.path)));
  }
  return findings;
}

export function detectDirectoryBudgets(files: FileEntry[], config: BlobBudgetConfig): Finding[] {
  const totals = new Map<string, number>();
  for (const file of files) {
    const parts = file.path.split('/');
    for (let i = 1; i < parts.length; i += 1) {
      const dir = parts.slice(0, i).join('/');
      totals.set(dir, (totals.get(dir) ?? 0) + file.size);
    }
  }
  return [...totals.entries()]
    .filter(([directory, size]) => size > config.maxDirectoryBytes && directory !== '.git')
    .map(([directory, size]) => finding('directory-budget', `${directory}/`, size, config.maxDirectoryBytes, severityForRatio(size, config.maxDirectoryBytes), `${directory}/ exceeds the directory budget.`, 'Split heavyweight samples, shrink fixtures, or add targeted ignores for generated output.'));
}

export function detectPathBudgets(files: FileEntry[], config: BlobBudgetConfig): Finding[] {
  const findings: Finding[] = [];
  for (const rule of config.pathBudgets) {
    const matching = files.filter((file) => matchesGlob(file.path, rule.pattern));
    const total = matching.reduce((sum, file) => sum + file.size, 0);
    if (total > rule.maxBytes) findings.push(finding('directory-budget', rule.pattern, total, rule.maxBytes, severityForRatio(total, rule.maxBytes, rule.severity ?? 'medium'), `${rule.pattern} exceeds its configured path budget.`, 'Tighten generated fixture size or raise the explicit path budget with a reason.'));
  }
  return findings;
}

export function detectExtensionBudgets(files: FileEntry[], config: BlobBudgetConfig): Finding[] {
  const findings: Finding[] = [];
  for (const rule of config.extensionBudgets) {
    const total = files.filter((file) => file.extension === rule.extension.toLowerCase()).reduce((sum, file) => sum + file.size, 0);
    if (total > rule.maxBytes) findings.push(finding('extension-budget', `*${rule.extension}`, total, rule.maxBytes, severityForRatio(total, rule.maxBytes, rule.severity ?? 'medium'), `${rule.extension} files exceed their configured extension budget.`, 'Compress, split, or generate these files during tests instead of committing all bytes.'));
  }
  return findings;
}

export function detectPackagePayload(payload: PackagePayloadSummary, config: BlobBudgetConfig): Finding[] {
  if (payload.totalBytes <= config.maxPackageBytes) return [];
  const largest = payload.files.slice().sort((a, b) => b.size - a.size).slice(0, 5).map((file) => file.path);
  return [finding('package-payload', 'npm package payload', payload.totalBytes, config.maxPackageBytes, severityForRatio(payload.totalBytes, config.maxPackageBytes), `Package payload estimate from ${payload.source} exceeds budget.`, 'Use package files allowlists, .npmignore, or smaller examples before publishing.', largest)];
}

export function sortFindings(findings: Finding[]): Finding[] {
  const order: Record<Finding['severity'], number> = { high: 0, medium: 1, low: 2 };
  return findings.sort((a, b) => order[a.severity] - order[b.severity] || b.size - a.size || a.kind.localeCompare(b.kind) || a.path.localeCompare(b.path));
}
