#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out_dir="$repo_root/tmp/fixture-budget-demo"

cd "$repo_root"
rm -rf "$out_dir"
mkdir -p "$out_dir"

npm run build

node dist/src/cli.js scan fixtures/clean --out "$out_dir/clean.md" --fail-on high --no-package
node dist/src/cli.js scan fixtures/heavy --format json --out "$out_dir/heavy.json" --fail-on high --no-package || status=$?

if [ "${status:-0}" -eq 0 ]; then
  echo "Expected heavy fixture to exceed the high threshold" >&2
  exit 1
fi

grep -q 'BlobBudget Report' "$out_dir/clean.md"
grep -q '"large-file"' "$out_dir/heavy.json"

printf 'Clean report: %s\n' "$out_dir/clean.md"
printf 'Heavy fixture JSON: %s\n' "$out_dir/heavy.json"
