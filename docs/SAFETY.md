# Safety model

BlobBudget is designed for local CI and agent-generated repositories.

- Scans are read-only.
- The only write during `scan` is the optional `--out` report file.
- `init` writes `.blobbudget.json` and refuses to overwrite unless `--force` is passed.
- No telemetry, uploads, secret scanning, or history rewriting are performed.
- `npm pack --dry-run --json` is used only to estimate package payloads for package directories.

If a finding is intentional, prefer an explicit path or extension budget over a broad ignore so future readers understand the size decision.
