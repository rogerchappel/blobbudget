# Configuration reference

BlobBudget reads `.blobbudget.json` from the scan root unless `--config` points somewhere else.

| Field | Purpose |
| --- | --- |
| `maxFileBytes` | Per-file budget. |
| `maxDirectoryBytes` | Aggregate budget for each directory. |
| `maxPackageBytes` | Budget for `npm pack --dry-run` payload. |
| `failOn` | CLI exit threshold: `low`, `medium`, or `high`. |
| `suspiciousExtensions` | Extensions to flag for human review. |
| `generatedPatterns` | Globs considered generated output. |
| `ignore` | Additional globs to skip during scans. |
| `pathBudgets` | Aggregate budgets for matched paths. |
| `extensionBudgets` | Aggregate budgets by extension. |

Rules are deterministic so JSON and Markdown reports can be snapshot-tested in CI.
