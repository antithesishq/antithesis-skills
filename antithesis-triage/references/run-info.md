# Run Info

Extract high-level information about a triage report.

## Get run metadata

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.getRunMetadata()"
```

The method returns `title`, the raw `metadata`, plus best-effort parsed
`conductedOn` and `source` fields.

## Get source images

The Environment section shows the Docker images used in this run.

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.getEnvironmentSourceImages()"
```

## Get findings

Findings are a historical record of when properties started or stopped failing across runs. They reveal how property outcomes have changed over time — for example, a property that was passing in a previous run but now fails, or one that was failing and has been fixed.

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.getFindingsGrouped()"
```
