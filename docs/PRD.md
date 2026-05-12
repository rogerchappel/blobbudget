# BlobBudget PRD

Status: in-progress

## Summary

A local repo bloat budget checker that finds oversized blobs, accidental binaries, fixture creep, and release-package weight before clones get chunky. 🧱

## Source attribution

Created during the twice-daily OSS factory run on 2026-05-13 after the current unbuilt idea pool had fewer than five candidates. Inspired by recurring Git and npm package bloat problems across OSS maintenance, but renamed/reframed as a deterministic local budget tool rather than copying a specific project. Web search was attempted during selection and was rate-limited by the provider.

## Target users

- OSS maintainers keeping repos fast to clone.
- Agents generating fixtures, screenshots, or builds.
- Developers preparing npm/source releases.

## Problem

Generated projects quietly collect large fixtures, checked-in build output, binary assets, and fat package payloads. By the time anyone notices, history is already heavy and release consumers pay for it forever.

## Goals

- Scan the working tree and Git history metadata offline.
- Enforce configurable file, directory, extension, and package-size budgets.
- Explain each finding with path, size, category, and fix suggestions.
- Emit Markdown and JSON reports stable enough for CI snapshots.
- Include safe defaults for TypeScript CLI repos.

## Non-goals

- Rewriting Git history.
- Uploading artifacts or telemetry.
- Replacing full secret scanners.

## V1 CLI

```bash
blobbudget scan . --out blobbudget.md
blobbudget scan fixtures/heavy --format json --fail-on medium
blobbudget init --preset node-cli
```

## Functional requirements

1. Walk a repo deterministically while respecting `.gitignore` by default.
2. Detect large files, suspicious binary extensions, generated build artifacts, duplicate blobs by hash, and package payload bloat.
3. Support `.blobbudget.json` budgets for path globs, extensions, package payloads, and severity thresholds.
4. Emit Markdown and JSON reports with stable sorting, totals, and remediation.
5. Provide fixture-backed tests for clean, heavy, duplicate, and package-bloat repos.

## Acceptance criteria

- `npm test`, `npm run check`, `npm run build`, and `npm run smoke` pass.
- `bash scripts/validate.sh` passes when present.
- Real CLI smoke scans checked-in fixtures and writes reports.
- README covers quick start, budgets, examples, safety model, limitations, and CI usage.
- Public GitHub repo `rogerchappel/blobbudget` has useful description and topics.
