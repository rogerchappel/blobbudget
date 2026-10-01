import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseBytes } from './bytes.js';
import { normalizeSeverity } from './severity.js';
import type { BlobBudgetConfig, BudgetRule, ExtensionBudget } from './types.js';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

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

const configFields = new Set([
  'maxFileBytes', 'maxFile',
  'maxDirectoryBytes', 'maxDirectory',
  'maxPackageBytes', 'maxPackage',
  'failOn', 'suspiciousExtensions', 'generatedPatterns', 'ignore',
  'pathBudgets', 'extensionBudgets'
]);

function readBudget(value: unknown, field: string): number {
  const parsed = parseBytes(value, -1);
  if (parsed <= 0) throw new ConfigError(`${field} must be a positive byte value.`);
  return parsed;
}

function readRules(value: unknown): BudgetRule[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ConfigError('pathBudgets must be an array.');
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') throw new ConfigError(`pathBudgets[${index}] must be an object.`);
    const rule = item as Record<string, unknown>;
    if (typeof rule.pattern !== 'string' || !rule.pattern) throw new ConfigError(`pathBudgets[${index}].pattern must be a non-empty string.`);
    if (rule.severity !== undefined && !['low', 'medium', 'high'].includes(String(rule.severity))) throw new ConfigError(`pathBudgets[${index}].severity must be low, medium, or high.`);
    return { pattern: rule.pattern, maxBytes: readBudget(rule.maxBytes ?? rule.max, `pathBudgets[${index}].maxBytes`), severity: normalizeSeverity(rule.severity, 'medium') };
  });
}

function readExtensionBudgets(value: unknown): ExtensionBudget[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ConfigError('extensionBudgets must be an array.');
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') throw new ConfigError(`extensionBudgets[${index}] must be an object.`);
    const rule = item as Record<string, unknown>;
    if (typeof rule.extension !== 'string' || !rule.extension) throw new ConfigError(`extensionBudgets[${index}].extension must be a non-empty string.`);
    if (rule.severity !== undefined && !['low', 'medium', 'high'].includes(String(rule.severity))) throw new ConfigError(`extensionBudgets[${index}].severity must be low, medium, or high.`);
    const extension = rule.extension.startsWith('.') ? rule.extension.toLowerCase() : `.${rule.extension.toLowerCase()}`;
    return { extension, maxBytes: readBudget(rule.maxBytes ?? rule.max, `extensionBudgets[${index}].maxBytes`), severity: normalizeSeverity(rule.severity, 'medium') };
  });
}

function readStringArray(value: unknown, fallback: string[], field: string): string[] {
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new ConfigError(`${field} must be an array of strings.`);
  const blankIndex = value.findIndex((item) => (item as string).trim().length === 0);
  if (blankIndex !== -1) throw new ConfigError(`${field}[${blankIndex}] must be a non-empty string.`);
  return value as string[];
}

export async function loadConfig(root: string, configPath?: string): Promise<BlobBudgetConfig> {
  const target = configPath ? path.resolve(root, configPath) : path.join(root, '.blobbudget.json');
  if (!existsSync(target)) {
    if (configPath) throw new ConfigError(`Config file not found: ${target}`);
    return { ...defaultConfig };
  }
  let parsed: Record<string, unknown>;
  try {
    const value = JSON.parse(await readFile(target, 'utf8')) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ConfigError('configuration must be a JSON object.');
    parsed = value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    throw new ConfigError(`Unable to read config ${target}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const unknownField = Object.keys(parsed).find((field) => !configFields.has(field));
  if (unknownField) throw new ConfigError(`Unknown configuration field: ${unknownField}.`);
  if (parsed.failOn !== undefined && !['low', 'medium', 'high'].includes(String(parsed.failOn))) throw new ConfigError('failOn must be low, medium, or high.');
  return {
    maxFileBytes: parsed.maxFileBytes === undefined && parsed.maxFile === undefined ? defaultConfig.maxFileBytes : readBudget(parsed.maxFileBytes ?? parsed.maxFile, 'maxFileBytes'),
    maxDirectoryBytes: parsed.maxDirectoryBytes === undefined && parsed.maxDirectory === undefined ? defaultConfig.maxDirectoryBytes : readBudget(parsed.maxDirectoryBytes ?? parsed.maxDirectory, 'maxDirectoryBytes'),
    maxPackageBytes: parsed.maxPackageBytes === undefined && parsed.maxPackage === undefined ? defaultConfig.maxPackageBytes : readBudget(parsed.maxPackageBytes ?? parsed.maxPackage, 'maxPackageBytes'),
    failOn: normalizeSeverity(parsed.failOn, defaultConfig.failOn),
    suspiciousExtensions: readStringArray(parsed.suspiciousExtensions, defaultConfig.suspiciousExtensions, 'suspiciousExtensions').map((item) => item.startsWith('.') ? item.toLowerCase() : `.${item.toLowerCase()}`),
    generatedPatterns: readStringArray(parsed.generatedPatterns, defaultConfig.generatedPatterns, 'generatedPatterns'),
    ignore: [...defaultConfig.ignore, ...readStringArray(parsed.ignore, [], 'ignore')],
    pathBudgets: readRules(parsed.pathBudgets),
    extensionBudgets: readExtensionBudgets(parsed.extensionBudgets)
  };
}

export function configTemplate(preset = 'node-cli'): string {
  const config = preset === 'node-cli' ? nodeCliPreset : defaultConfig;
  return `${JSON.stringify(config, null, 2)}\n`;
}
