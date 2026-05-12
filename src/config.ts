import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseBytes } from './bytes.js';
import { normalizeSeverity } from './severity.js';
import type { BlobBudgetConfig, BudgetRule, ExtensionBudget } from './types.js';

export const defaultConfig: BlobBudgetConfig = {
  maxFileBytes: 512 * 1024,
  maxDirectoryBytes: 2 * 1024 * 1024,
  maxPackageBytes: 750 * 1024,
  failOn: 'medium',
  suspiciousExtensions: ['.zip', '.tar', '.gz', '.tgz', '.7z', '.rar', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.mov', '.pdf', '.sqlite', '.db'],
  generatedPatterns: ['dist/**', 'build/**', 'coverage/**', '.next/**', '.turbo/**', '*.tsbuildinfo'],
  ignore: ['.git/**', 'node_modules/**', '.blobbudget-out/**'],
  pathBudgets: [],
  extensionBudgets: []
};

export const nodeCliPreset: BlobBudgetConfig = {
  ...defaultConfig,
  pathBudgets: [
    { pattern: 'fixtures/**', maxBytes: 1024 * 1024, severity: 'medium' },
    { pattern: 'docs/**', maxBytes: 2 * 1024 * 1024, severity: 'low' },
    { pattern: 'src/**', maxBytes: 1024 * 1024, severity: 'medium' }
  ],
  extensionBudgets: [
    { extension: '.json', maxBytes: 256 * 1024, severity: 'medium' },
    { extension: '.md', maxBytes: 512 * 1024, severity: 'low' }
  ]
};

function readRules(value: unknown): BudgetRule[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const rule = item as Record<string, unknown>;
    if (typeof rule.pattern !== 'string') return [];
    return [{ pattern: rule.pattern, maxBytes: parseBytes(rule.maxBytes ?? rule.max, 0), severity: normalizeSeverity(rule.severity, 'medium') }];
  }).filter((rule) => rule.maxBytes > 0);
}

function readExtensionBudgets(value: unknown): ExtensionBudget[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const rule = item as Record<string, unknown>;
    if (typeof rule.extension !== 'string') return [];
    const extension = rule.extension.startsWith('.') ? rule.extension.toLowerCase() : `.${rule.extension.toLowerCase()}`;
    return [{ extension, maxBytes: parseBytes(rule.maxBytes ?? rule.max, 0), severity: normalizeSeverity(rule.severity, 'medium') }];
  }).filter((rule) => rule.maxBytes > 0);
}

function readStringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : fallback;
}

export async function loadConfig(root: string, configPath?: string): Promise<BlobBudgetConfig> {
  const target = configPath ? path.resolve(root, configPath) : path.join(root, '.blobbudget.json');
  if (!existsSync(target)) return { ...defaultConfig };
  const parsed = JSON.parse(await readFile(target, 'utf8')) as Record<string, unknown>;
  return {
    maxFileBytes: parseBytes(parsed.maxFileBytes ?? parsed.maxFile, defaultConfig.maxFileBytes),
    maxDirectoryBytes: parseBytes(parsed.maxDirectoryBytes ?? parsed.maxDirectory, defaultConfig.maxDirectoryBytes),
    maxPackageBytes: parseBytes(parsed.maxPackageBytes ?? parsed.maxPackage, defaultConfig.maxPackageBytes),
    failOn: normalizeSeverity(parsed.failOn, defaultConfig.failOn),
    suspiciousExtensions: readStringArray(parsed.suspiciousExtensions, defaultConfig.suspiciousExtensions).map((item) => item.startsWith('.') ? item.toLowerCase() : `.${item.toLowerCase()}`),
    generatedPatterns: readStringArray(parsed.generatedPatterns, defaultConfig.generatedPatterns),
    ignore: [...defaultConfig.ignore, ...readStringArray(parsed.ignore, [])],
    pathBudgets: readRules(parsed.pathBudgets),
    extensionBudgets: readExtensionBudgets(parsed.extensionBudgets)
  };
}

export function configTemplate(preset = 'node-cli'): string {
  const config = preset === 'node-cli' ? nodeCliPreset : defaultConfig;
  return `${JSON.stringify(config, null, 2)}\n`;
}
