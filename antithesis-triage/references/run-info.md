# Run Info

Extract high-level information about a triage report.

## Get run metadata for a single run

```bash
snouty runs --json show "$RUN_ID"
```

The snouty command returns a json block with metadata about the run.

## Opening the triage report in a browser

If the user wants to view the full report in a browser, use the following command:

```bash
snouty runs show "$RUN_ID" --web
```

This opens the run's triage report in the user's browser. `--web` only works when
a triage report exists; for runs without one (e.g. `incomplete` or `cancelled`),
it errors out — there is nothing to open.

If the user does not have access to the browser on this machine (for example, this is a headless vm), you can instead get the full url from the `show` commands json output at the path: `links.triage_report`.
