# Simplified Debugger

The simplified debugger provides a direct UI for browsing logs, running bash
commands, and extracting files from containers — without the Monaco notebook
editor.

Prefer this mode for straightforward tasks: running shell commands, reading
files, listing directories, and extracting artifacts. Switch to advanced mode
only when you need the full notebook API (branching, event sets, programmatic
inspection).

**Note:** Different tenants may open the debugger in either simplified or
advanced mode by default. After injecting the runtime, check with
`window.__antithesisDebug.getMode()`. If it returns `"advanced"` and you want
simplified mode, call `window.__antithesisDebug.switchMode("simplified")`.

## Runtime injection

The simplified debugger uses the same runtime as advanced mode. Inject it after
the page loads:

```bash
cat assets/antithesis-debug.js \
  | agent-browser --session "$SESSION" eval --stdin
```

Then check which mode is active and wait for readiness:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.getMode()"
```

If the result is `"advanced"`, switch to simplified:

```bash
agent-browser --session "$SESSION" eval \
  'window.__antithesisDebug.switchMode("simplified")'
```

Then wait for the simplified view to be ready:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.simplified.waitForReady()"
```

## Layout

The page has three sections:

1. **Log view** (top) — virtual-scrolling timeline of events from the test run.
   Each row shows a vtime, source process, container name, and log output.
2. **Command input** (bottom) — moment display, container selector, bash text
   area, and Send button.
3. **Output area** (middle, appears after sending) — results of commands and
   file extractions stack up between the log view and the input area.

## Selecting a moment

Click any row in the log view to set the debugger's moment and container.

The moment is a point in virtual time during the Antithesis test run. When you
click a log line:

- The vtime input updates to that row's virtual time.
- The container selector updates to the container that emitted that log line.

You can also type a vtime directly into the vtime input field.

### Reading the current moment and container

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.simplified.getMoment()"
```

Returns `{ ok, vtime }`.

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.simplified.getContainer()"
```

Returns `{ ok, container }`.

### Listing available containers

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.simplified.getContainers()"
```

Returns `{ ok, containers }` with deduplicated container names from the
dropdown.

### Browsing log rows

Get visible log rows with their text and position:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.simplified.getVisibleLogRows()"
```

Returns `{ ok, rows, totalCount }`. Each row has `index`, `text`, and
`isAnchor` (whether it's the currently selected moment).

Click a specific row to set the moment:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.simplified.clickLogRow(5)"
```

## Running a bash command

1. Send a command:

   ```bash
   agent-browser --session "$SESSION" eval \
     'window.__antithesisDebug.simplified.runCommand("ls -la /opt/antithesis/")'
   ```

   Returns `{ ok, sent, script, outputCountBefore }`. Save `outputCountBefore`
   for polling.

2. Wait for the result (commands typically take 3–10 seconds):

   ```bash
   agent-browser --session "$SESSION" eval \
     "window.__antithesisDebug.simplified.waitForNewOutput(COUNT_BEFORE)"
   ```

   Replace `COUNT_BEFORE` with the value from step 1. Returns the output with
   `{ ok, header, lines, lineCount, downloadLink, attempts, waitedMs }`.

   Pass options for a different timeout:

   ```bash
   agent-browser --session "$SESSION" eval \
     "window.__antithesisDebug.simplified.waitForNewOutput(COUNT_BEFORE, { timeoutMs: 60000 })"
   ```

3. Or read the latest output directly (non-polling):
   ```bash
   agent-browser --session "$SESSION" eval \
     "window.__antithesisDebug.simplified.getLastOutput()"
   ```

### Command isolation

Each command runs in an **observation branch** — an alternative fork of time. It
does not affect the main timeline. Commands sent separately are independent; they
do not run as follow-ups to each other.

## Extracting and downloading a file

1. Send an extraction request:

   ```bash
   agent-browser --session "$SESSION" eval \
     'window.__antithesisDebug.simplified.extractFile("/path/to/file")'
   ```

   Returns `{ ok, sent, path, outputCountBefore }`.

2. Wait for the result:

   ```bash
   agent-browser --session "$SESSION" eval \
     "window.__antithesisDebug.simplified.waitForNewOutput(COUNT_BEFORE)"
   ```

   The output for a file extraction includes a `downloadLink` field with
   `{ text, href }` — the text shows the filename and size, the href is a
   blob URL.

3. Snapshot the output to get a clickable ref for the download link:

   ```bash
   agent-browser --session "$SESSION" snapshot -i -s ".ceres_output:last-child"
   ```

   This returns a ref like `@e13` for the download link.

4. Download the file using the ref. The path argument to `download` is a
   **directory**, not a filename — the file is saved with an auto-generated
   name inside it:

   ```bash
   mkdir -p /tmp/extracted
   agent-browser --session "$SESSION" download @REF /tmp/extracted/
   ```

5. Read the downloaded file. There will be exactly one new file in the
   directory:
   ```bash
   cat /tmp/extracted/*
   ```

### Complete example

```bash
# Extract
agent-browser --session "$SESSION" eval \
  'window.__antithesisDebug.simplified.extractFile("/opt/antithesis/workload-entrypoint.sh")'
# => { ok: true, outputCountBefore: 0, ... }

# Wait for output
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.simplified.waitForNewOutput(0)"
# => { ok: true, downloadLink: { text: "Download workload-entrypoint.sh (1278 bytes)", ... }, ... }

# Get the download link ref
agent-browser --session "$SESSION" snapshot -i -s ".ceres_output:last-child"
# => link "Download workload-entrypoint.sh (1278 bytes)" [ref=e5]

# Download to a local directory
mkdir -p /tmp/extracted
agent-browser --session "$SESSION" download @e5 /tmp/extracted/

# Read the file
cat /tmp/extracted/*
```

## Reading previous outputs

All command and extraction results stack in the output area.

```bash
# Count of output sections
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.simplified.getOutputCount()"

# All output headers
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.simplified.getOutputHeaders()"

# Read a specific output by index
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.simplified.getOutput(0)"
```

## Filtering and searching logs

```bash
# Filter logs to show only matching rows
agent-browser --session "$SESSION" eval \
  'window.__antithesisDebug.simplified.filterLogs("error")'

# Clear the filter
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.simplified.clearFilter()"
```

## Switching to advanced mode

```bash
agent-browser --session "$SESSION" eval \
  'window.__antithesisDebug.switchMode("advanced")'
```

After switching, follow the `references/notebook.md` and
`references/actions.md` guides. The notebook API is available at
`window.__antithesisDebug.notebook` and `window.__antithesisDebug.actions`.

To return to simplified mode:

```bash
agent-browser --session "$SESSION" eval \
  'window.__antithesisDebug.switchMode("simplified")'
```
