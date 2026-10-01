function escapeRegex(value: string): string {
  return value.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function globToRegExp(pattern: string): RegExp {
  const source = normalizePath(pattern.trim());
  let regex = '^';
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (char === '*' && next === '*') {
      if (source[i + 2] === '/') {
        regex += '(?:.*/)?';
        i += 2;
        continue;
      }
      regex += '.*';
      i += 1;
    } else if (char === '*') {
      regex += '[^/]*';
    } else if (char === '?') {
      regex += '[^/]';
    } else {
      regex += escapeRegex(char ?? '');
    }
  }
  regex += '$';
  return new RegExp(regex);
}

export function matchesGlob(path: string, pattern: string): boolean {
  const normalized = normalizePath(path);
  const p = normalizePath(pattern);
  if (!p) return false;
  if (p.endsWith('/')) return normalized.startsWith(p);
  if (!p.includes('*') && !p.includes('?')) {
    return normalized === p || normalized.startsWith(`${p}/`);
  }
  return globToRegExp(p).test(normalized);
}

export function matchesAny(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesGlob(path, pattern));
}
