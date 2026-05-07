# Downloading the MVD events log

When you need the full event log from a Multiverse Debugger session for
local analysis (jq filtering, fault-window inspection, cross-referencing
with code), download it via the `assets/download-mvd-log.sh` script. It
drives `agent-browser`, captures the page's "Download as JSON" / "Download
as TXT" / "Download as CSV" output, and (for JSON) post-processes the
result through `assets/process-logs.py` to add `vtime_seconds` and
`active_faults` annotations.

## When to use

- Triaging an MVD session offline — pull the log once, query it
  repeatedly with `jq` rather than re-clicking through the browser.
- Cross-referencing the MVD log with logs from other tools or with the
  system-under-test source code.
- Sharing a snapshot of the debugger session's events with a teammate.

For interactive debugging (running shell commands inside containers,
inspecting filesystem state, time-traveling), use the simplified or
notebook workflows in this skill instead — those don't need the log
download.

## Prerequisites

- `agent-browser` installed and authenticated to the tenant. If you are
  not authenticated, run the interactive login flow first (see the
  web-page-visiting skill's auth setup reference).
- A debugging-session URL (`https://TENANT.antithesis.com/debugging-session/...`).

## Usage

```bash
assets/download-mvd-log.sh \
  --url "$DEBUG_URL" \
  -o /tmp/mvd/${SESSION_ID}.json
```

Optional flags:

- `--format json|txt|csv` (default `json`). Use `txt` for quick eyeballing
  in a pager; `json` for any analysis.
- `--raw` — write the unmodified JSON array; skip `process-logs.py`
  annotation. Use this if you want the file in its on-the-wire form
  (no `vtime_seconds`, no `active_faults`). Only meaningful with
  `--format json`.

Always write to a unique path. Other agents may be running concurrently.

## What the script does

1. Opens the URL with shared `--session-name antithesis` auth.
2. Verifies the URL is on a `/debugging-session/...` path; bails (exit 2)
   if redirected to a login page.
3. Injects `assets/antithesis-debug.js`.
4. Waits for `simplified.waitForReady()` (the top interaction area), then
   polls `simplified.eventsLogReady(format)` until the events log panel
   has rendered. The events panel renders later than the simplified
   view's interaction area, and after page settle two `events.*` download
   anchors exist (one hidden in a notebook overlay, one in the visible
   Debug Timeline panel). The helper picks the visible one.
5. Calls `simplified.prepareLogDownload(format)` to force the
   `<a-menu>`'s shadow-root menu visible and tag the link.
6. Captures the click via `agent-browser download`.
7. For `json` (and not `--raw`): pipes through `assets/process-logs.py` →
   JSON array annotated with `vtime_seconds` and `active_faults`.
8. For `txt` / `csv` / `--raw`: writes the captured file verbatim.

## Output format

`json` output is a JSON array of events. Each event has at minimum:

```json
{
  "moment": {
    "_vtime_ticks": <number>,
    "input_hash": <string>,
    "session_id": <string>
  },
  "source": {"name": <string>, ...},
  ...
}
```

Note the legacy `moment._vtime_ticks` field (integer ticks, 2³² per
second). `process-logs.py` accepts both this and the newer
`moment.vtime` (string seconds) format. After annotation each event also
carries `vtime_seconds` (rounded float, for human-readable jq filters)
and `active_faults` (snapshot of currently-open fault windows).

For jq query examples, see the triage skill's logs reference (the same
event shape applies).

## Known limitations

- The MVD page lazy-renders the events panel after the simplified view's
  interaction area becomes interactive. The script waits up to 30s for
  the panel; in slow environments it may need more.
- The downloaded log uses `_vtime_ticks` (legacy SPA format), not the
  API's `vtime` string. To address a moment when calling
  `snouty runs logs` against this log, convert ticks to seconds:
  `vtime_seconds = _vtime_ticks / 4294967296`.
