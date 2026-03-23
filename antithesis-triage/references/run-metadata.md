# Run Metadata

Extract high-level information about a triage report.

Then run:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.getRunMetadata()"
```

The method returns `title`, the raw `metadata`, plus best-effort parsed
`conductedOn` and `source` fields.
