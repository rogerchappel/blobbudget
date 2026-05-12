# Reports

BlobBudget writes Markdown by default and JSON when `--format json` is passed.

Both formats include:

- Summary totals.
- Counts by severity.
- Stable finding order: severity, size, kind, path.
- Largest files.
- Package payload metadata when enabled.

The scanner pins `scannedAt` to the Unix epoch in reports so fixture snapshots and CI diffs stay stable. Consumers should use file modification time or CI metadata if they need wall-clock timestamps.
