const units: Record<string, number> = {
  b: 1,
  byte: 1,
  bytes: 1,
  kb: 1024,
  kib: 1024,
  mb: 1024 ** 2,
  mib: 1024 ** 2,
  gb: 1024 ** 3,
  gib: 1024 ** 3
};

export function parseBytes(input: unknown, fallback = 0): number {
  if (typeof input === 'number' && Number.isFinite(input)) return Math.max(0, Math.floor(input));
  if (typeof input !== 'string') return fallback;
  const match = input.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
  if (!match) return fallback;
  const value = Number(match[1]);
  const unit = match[2] ?? 'b';
  const multiplier = units[unit];
  return multiplier ? Math.floor(value * multiplier) : fallback;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const labels = ['KiB', 'MiB', 'GiB'];
  let value = bytes;
  let label = 'B';
  for (const next of labels) {
    value /= 1024;
    label = next;
    if (value < 1024) break;
  }
  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${label}`;
}
