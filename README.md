# BlobBudget

BlobBudget is a local-first TypeScript CLI that catches repository bloat before clones, fixtures, and release packages get chunky. It scans the working tree, respects `.gitignore` by default, applies configurable budgets, and writes stable Markdown or JSON reports for CI.

## Quick start

```bash
npm install
npm run build
node dist/src/cli.js init --preset node-cli
node dist/src/cli.js scan . --out blobbudget.md --fail-on medium
```

After publishing you can use the package binary directly:

```bash
blobbudget scan . --format json --fail-on medium
```

## What it detects

- Oversized files that exceed `maxFileBytes`.
- Suspicious binary/archive extensions such as `.zip`, `.png`, `.pdf`, and `.sqlite`.
- Generated artifacts in paths like `dist/**`, `build/**`, and `coverage/**`.
- Duplicate blobs by SHA-256 content hash.
- Directory, path, and extension budgets.
- npm package payload bloat via `npm pack --dry-run --json` when available.

## Configuration

Run `blobbudget init --preset node-cli` to create `.blobbudget.json`:

`node-cli` is the only supported preset. For scans, `--fail-on` accepts
`low`, `medium`, or `high`; other option values are rejected with usage help.

```json
{
  "maxFileBytes": "512 KiB",
  "maxDirectoryBytes": "2 MiB",
  "maxPackageBytes": "750 KiB",
  "failOn": "medium",
  "pathBudgets": [
    { "pattern": "fixtures/**", "maxBytes": "1 MiB", "severity": "medium" }
  ],
  "extensionBudgets": [
    { "extension": ".json", "maxBytes": "256 KiB", "severity": "medium" }
  ]
}
```

Sizes accept bytes or human units (`KiB`, `MiB`, `GiB`). Globs are intentionally small and deterministic: `*`, `?`, and `**` are supported.

## Examples

```bash
blobbudget scan . --out blobbudget.md
blobbudget scan fixtures/heavy --format json --fail-on medium
blobbudget scan . --no-package --no-gitignore
```

Run the fixture-backed demo:

```bash
bash demo/run-fixture-budget-demo.sh
```

The demo writes a clean Markdown report and a JSON report for the heavy fixture
under `tmp/fixture-budget-demo/`, then verifies the expected report markers.
Promotion notes for a short walkthrough live in
[`docs/promo/fixture-budget-demo-brief.md`](docs/promo/fixture-budget-demo-brief.md).

See `examples/node-cli.blobbudget.json` and `examples/github-actions.yml` for copy-paste starting points.

## CI usage

Use a medium threshold to block meaningful bloat while still allowing low-severity advisory findings:

```bash
npm ci
npm run build
npx blobbudget scan . --out blobbudget.md --fail-on medium
```

Upload `blobbudget.md` as a workflow artifact or paste it into pull request comments.

## Safety model

BlobBudget is read-only during scans except for an explicitly requested report path. It does not rewrite Git history, delete files, upload telemetry, or contact remote services. Package payload measurement shells out to local `npm pack --dry-run --json`; if that fails, BlobBudget falls back to a working-tree estimate.

## Package contents

The npm package intentionally ships the compiled CLI, README, license, security policy, changelog, and contribution guide. Before a release, verify the tarball contents with:

```bash
npm run package:smoke
```

## Limitations

- It scans the current working tree, not every historical Git object.
- `.gitignore` basename patterns match at any depth, while patterns beginning
  with `/` are anchored to the scan root. Directory patterns ending in `/` are
  also supported. Negation (`!`), escaped leading `#` or `!`, and nested
  `.gitignore` files are not currently supported.
- Binary detection is heuristic; extension and size rules are the primary signal.
- It reports remediation suggestions but never mutates your repo.

## Development

```bash
npm install
npm test
npm run check
npm run build
npm run smoke
bash scripts/validate.sh
```
