# Run Info

Extract high-level information about a triage report.

## Get run metadata for a single run

```bash
snouty runs --json show "$RUN_ID"
```

The snouty command returns `title`, the raw `metadata`, plus best-effort parsed
`conductedOn` and `source` fields. Also in the data are the source images used in this run.


