# Error reports

Not every report loads normally. Antithesis may show an **error report**
instead of the usual property/findings view. The runtime detects
two kinds of error:

| Error type        | `error.type`    | What it looks like                                                                                                                                                                                                             |
| ----------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Setup failure** | `setup_error`   | The report replaces the normal sections with a single "Error" card describing a container setup failure (e.g. a container died, the setup-complete event was never emitted). Properties, Findings, and Utilization are absent. |
| **Runtime error** | `runtime_error` | A red/orange banner appears at the top of the page (class `GeneralErrorNew`). The normal sections may partially render but one or more (typically Findings) will be stuck on "Loading..." forever.                             |

## Detection

`waitForReady()` short-circuits when an error is detected — it will **not**
wait 60 seconds for sections that will never load. The returned result object
will contain an `error` field:

```json
{
  "attempts": 1,
  "waitedMs": 42,
  "error": {
    "type": "setup_error",
    "summary": "Container setup failure",
    "details": "Setup validation failures:\n• Container floci died during environment setup with exit code 1..."
  }
}
```

**After every report `waitForReady()` call, check `result.error`.** If it is
present, the report is an error report and you should change your workflow:

1. **Read the error details.** `result.error.details` contains the error
   message. For setup errors this includes the validation failure and
   troubleshooting steps. For runtime errors it contains the backend query
   failure message.
2. **Read any inline log viewers.** Sometimes errors include details in log
   viewers. Read those before continuing.
3. **Report the error to the user.** Explain which error type was found,
   quote the details, and suggest next steps (fix the setup, contact
   Antithesis, or re-run).

You can also check for errors at any time with:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.report.getError()"
```

This returns the error object (same shape as `result.error`) or `null` if the
report is healthy.

## What to skip on error reports

- **Setup errors (`setup_error`)**: Do **not** call property, findings methods —
  those sections do not exist. Focus on metadata, environment images, the error
  details, and any inline error logs.
- **Runtime errors (`runtime_error`)**: Runtime errors means something broke on
  Antithesis's side while building the report. You may encounter errors while
  extracting any data or certain parts of the report may fail to load. Proceed
  cautiously, but still try to extract what you can for the user.

## Downloading inline error logs

Error reports may expose inline log panes. To download them, first discover
the available log viewers, then use `prepareDownload` with the correct index:

```bash
# List log panes on the page (works on any page with log viewers).
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.logs.getLogViewers()"
```

Each entry has `index`, `label`, `itemCount`, and `visible`. Use the `index`
to prepare and download:

```bash
# Prepare the download link for pane 0 as JSON.
agent-browser --session "$SESSION" eval \
  "window.__antithesisTriage.logs.prepareDownload('json', 0)"

# Download the file.
agent-browser --session "$SESSION" download \
  'a.sequence_printer_menu_button[data-triage-dl]' /tmp/error-logs.json
```

Downloaded logs are minified single-line JSON — always use `jq` to inspect them, never `cat` or `wc -l`. `jq length <file>` is a good first command to start with.

For multiple log panes, repeat with each index.

## Known errors cheatsheet

### `Error in reducer serialize`

- **Type:** `runtime_error`
- **Cause:** Antithesis backend failed to serialize data used in the generation of the report. Some of the sections in the report may not load.
- **What to do:** Triage what data you can, report the error to the user if it prevents you from making progress. This is an Antithesis error, not a SUT bug.

### `Setup validation failures`

- **Type:** `setup_error`
- **Cause:** One or more setup checks failed (e.g. missing setup-complete event, container not joining network).
- **What to do:** Read `error.details` for the specific validation failures. Check any inline log views for detailed logs. Verify the setup-complete event is being emitted properly. Remember that Antithesis does not run any test-templates before receiving setup-complete.
