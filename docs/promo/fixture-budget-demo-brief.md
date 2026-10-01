# BlobBudget fixture budget demo brief

## Demo angle

Show how BlobBudget catches repository bloat with local fixture scans before oversized files or package payloads become release friction.

## 60 second flow

1. Run `bash demo/run-fixture-budget-demo.sh`.
2. Open `tmp/fixture-budget-demo/clean.md` to show a clean Markdown report.
3. Open `tmp/fixture-budget-demo/heavy.json` to show a deterministic `large-file` finding from the heavy fixture.
4. Point to `.blobbudget.json` and `examples/node-cli.blobbudget.json` as copy-paste starting points.
5. Close with the safety model: BlobBudget scans locally and never mutates the repository during `scan`.

## Useful hooks

- "Your fixtures should help tests, not quietly bloat every clone."
- "Make repository size reviewable before the package is cut."
- "BlobBudget turns repo bloat into a small, deterministic CI artifact."

## Verification for the demo

Run:

```bash
bash demo/run-fixture-budget-demo.sh
```

The script builds the CLI, writes Markdown and JSON reports under `tmp/fixture-budget-demo/`, and verifies report markers with targeted text checks.
