import type { Severity } from './types.js';

const rank: Record<Severity, number> = { low: 1, medium: 2, high: 3 };

export function normalizeSeverity(value: unknown, fallback: Severity = 'medium'): Severity {
  return value === 'low' || value === 'medium' || value === 'high' ? value : fallback;
}

export function severityAtLeast(actual: Severity, threshold: Severity): boolean {
  return rank[actual] >= rank[threshold];
}

export function severityForRatio(size: number, budget: number, base: Severity = 'medium'): Severity {
  if (budget <= 0) return 'high';
  const ratio = size / budget;
  if (ratio >= 2) return 'high';
  if (ratio >= 1.25 && base === 'low') return 'medium';
  if (ratio >= 1.5) return 'high';
  return base;
}

export function emptySeverityCounts(): Record<Severity, number> {
  return { low: 0, medium: 0, high: 0 };
}
