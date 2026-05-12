import { formatBytes } from './bytes.js';
import type { Finding, ScanReport } from './types.js';

function row(values: string[]): string {
  return `| ${values.map((value) => value.replace(/\|/g, '\\|')).join(' | ')} |`;
}

function findingRow(finding: Finding): string {
  return row([finding.severity, finding.kind, finding.path, formatBytes(finding.size), finding.budget ? formatBytes(finding.budget) : '—', finding.suggestion]);
}

export function renderMarkdown(report: ScanReport): string {
  const lines = [
    '# BlobBudget Report',
    '',
    `Root: \`${report.summary.root}\``,
    '',
    '## Summary',
    '',
    `- Files scanned: ${report.summary.fileCount}`,
    `- Total bytes: ${formatBytes(report.summary.totalBytes)}`,
    `- Findings: ${report.summary.findingCount}`,
    `- Severity: ${report.summary.bySeverity.high} high / ${report.summary.bySeverity.medium} medium / ${report.summary.bySeverity.low} low`,
    ''
  ];
  if (report.packagePayload) {
    lines.push('## Package payload', '', `- Source: ${report.packagePayload.source}`, `- Total: ${formatBytes(report.packagePayload.totalBytes)}`, '');
  }
  lines.push('## Findings', '');
  if (report.findings.length === 0) {
    lines.push('No bloat findings. Nice and lean.');
  } else {
    lines.push(row(['Severity', 'Kind', 'Path', 'Size', 'Budget', 'Suggestion']));
    lines.push(row(['---', '---', '---', '---:', '---:', '---']));
    for (const item of report.findings) lines.push(findingRow(item));
  }
  lines.push('', '## Largest files', '', row(['Path', 'Size', 'Extension']), row(['---', '---:', '---']));
  for (const file of report.summary.largestFiles) lines.push(row([file.path, formatBytes(file.size), file.extension || 'none']));
  lines.push('');
  return `${lines.join('\n')}\n`;
}
