# Configuration reference

BlobBudget reads `.blobbudget.json` from the scan root unless `--config` points somewhere else.

If the implicit `.blobbudget.json` is absent, BlobBudget uses its defaults. A path passed
with `--config` is an explicit contract: a missing, unreadable, malformed, or invalid file
stops the scan with exit code 2. Invalid values are never discarded in favor of weaker
defaults; byte budgets must be positive numbers or supported byte strings, severities must
be `low`, `medium`, or `high`, and list fields must contain values of the documented shape.
Unknown top-level fields are rejected so misspelled settings cannot silently fall back to
defaults. Entries in `suspiciousExtensions`, `generatedPatterns`, and `ignore` must be
non-empty strings; blank or whitespace-only entries are invalid.

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

The shorter `maxFile`, `maxDirectory`, and `maxPackage` aliases are also accepted for the
corresponding byte-budget fields. No other top-level keys are accepted.

Rules are deterministic so JSON and Markdown reports can be snapshot-tested in CI.

Git ignore rules are enabled by default. BlobBudget reads `.gitignore` files at
the scan root and in nested directories, applies each file only to its subtree,
and interprets leading `/` relative to the directory containing that file.
Rules retain Git's ordered negation behavior, so a later `!` rule can re-include
a path matched earlier. Configuration `ignore` globs are applied after Git ignore
rules and are always exclusions. Use `--no-gitignore` to disable repository Git
ignore files without disabling configured `ignore` globs.
