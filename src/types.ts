export type Severity = 'low' | 'medium' | 'high';

export type FindingKind =
  | 'large-file'
  | 'binary-extension'
  | 'generated-artifact'
  | 'duplicate-blob'
  | 'directory-budget'
  | 'extension-budget'
  | 'package-payload';

export interface BudgetRule {
  pattern: string;
  maxBytes: number;
  severity?: Severity;
}

export interface ExtensionBudget {
  extension: string;
  maxBytes: number;
  severity?: Severity;
}

export interface BlobBudgetConfig {
  maxFileBytes: number;
  maxDirectoryBytes: number;
  maxPackageBytes: number;
  failOn: Severity;
  suspiciousExtensions: string[];
  generatedPatterns: string[];
  ignore: string[];
  pathBudgets: BudgetRule[];
  extensionBudgets: ExtensionBudget[];
}

export interface ScanOptions {
  root: string;
  configPath?: string;
  respectGitignore: boolean;
  includePackagePayload: boolean;
  failOn?: Severity;
}

export interface FileEntry {
  path: string;
  absolutePath: string;
  size: number;
  extension: string;
  hash: string;
  isBinary: boolean;
}

export interface Finding {
  kind: FindingKind;
  severity: Severity;
  path: string;
  size: number;
  budget?: number;
  message: string;
  suggestion: string;
  relatedPaths?: string[];
}

export interface ScanSummary {
  root: string;
  scannedAt: string;
  fileCount: number;
  totalBytes: number;
  findingCount: number;
  bySeverity: Record<Severity, number>;
  largestFiles: Array<Pick<FileEntry, 'path' | 'size' | 'extension'>>;
}

export interface ScanReport {
  summary: ScanSummary;
  config: BlobBudgetConfig;
  findings: Finding[];
  packagePayload?: PackagePayloadSummary;
}

export interface PackagePayloadSummary {
  files: Array<{ path: string; size: number }>;
  totalBytes: number;
  source: 'npm-pack-dry-run' | 'working-tree-estimate';
}
