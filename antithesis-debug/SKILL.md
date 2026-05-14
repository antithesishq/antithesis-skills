---
name: antithesis-debug
description: >
  Use this skill to interactively debug Antithesis test runs using the
  multiverse debugger (MVD session). Open a debugging-session URL, inspect container
  filesystems and runtime state, run shell commands, and extract evidence
  from inside the Antithesis environment. Supports both the simplified
  debugger (default) and the advanced notebook mode.
compatibility: Requires agent-browser v0.23.4+ (https://github.com/vercel-labs/agent-browser).
metadata:
  version: "2026-05-13"
---

# Antithesis Multiverse Debugger

Use the `agent-browser` skill to interact with the Antithesis multiverse
debugger.

Every debugging session should use:

- a fresh, unique `SESSION` value such as `antithesis-debug-$(date +%s)-$$`

Use `--session-name antithesis` so `agent-browser` manages shared
authentication state automatically, while `--session "$SESSION"` keeps each
debugging run isolated from other concurrent agents. Close the unique live
session when debugging is complete.

## When to use this skill

Use this when:

- the user gives an Antithesis debugging-session URL
- the user makes a request to inspect container filesystem, runtime state, or events inside Antithesis
- the triage skill has launched an MVD session when investigating the results of a run

For auth and report navigation, use the `antithesis-triage` skill. It already
encodes the right `agent-browser` session model. This skill handles the
debugger itself.

## Gathering user input

Before starting, collect the following from the user:

1. **Debugger URL** (required) — A debugging-session URL like `https://TENANT.antithesis.com/debugging-session/...`.
2. **What to investigate** — Are we checking filesystem contents? Runtime state? Specific artifacts?
3. **Container name** (if known) — The name of the container to target. If not provided, the log view or container dropdown will show available containers.

## Simplified vs. advanced mode

The debugger has two modes. **Prefer simplified mode** — it is sufficient for
most tasks.

| Mode           | Best for                                                                                         | How it works                                                            |
| -------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **Simplified** | Running shell commands, reading files, listing directories, extracting artifacts                 | Click log lines to set moment/container, type bash commands, press Send |
| **Advanced**   | Programmatic inspection, branching, event sets, custom JavaScript, multi-step notebook workflows | Monaco editor with JavaScript cells, action authorization, runtime API  |

### Detecting which mode is active

Different tenants may open the debugger in either mode by default. After
injecting the runtime (see `references/setup-session.md`), check which mode is
active:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.getMode()"
```

Returns `"simplified"` or `"advanced"`. To switch:

```bash
agent-browser --session "$SESSION" eval \
  'window.__antithesisDebug.switchMode("simplified")'
```

### When to escalate to advanced mode

Switch to advanced mode only when you need:

- Branching (`moment.branch()`) and advancing time (`branch.wait`, `branch.wait_until`)
- Exploring multiple random histories from the same moment (`branch.send_input`)
- Event set queries (`environment.events.up_to(moment)`, `.contains({source})`)
- Fault injector state inspection or control (`environment.fault_injector.pause/unpause`)
- Background processes and process-exit awaiting (`run_in_background`, `p.exits`)
- Complex multi-cell notebook workflows with grouped authorization
- The full JavaScript notebook API
- As an escape hatch when something in simplified mode isn't working

To switch programmatically, call `window.__antithesisDebug.switchMode("advanced")`.
This is what `getMode()` reports. **Note:** there is a separate "Simple
mode" / "Advanced mode" tab strip in the right pane (`.display_area__tabs`)
that `switchMode()` does NOT click; the two can disagree. The right-pane
tab strip controls the help / pop-out panel content. To read the on-page
advanced-mode help (a canonical ~5KB reference for the notebook API), click
the "Advanced mode" tab in that strip and read
`document.querySelector(".display_area__layout").innerText`. See
`references/advanced-debugger.md`.

## Reference files

Each reference file covers a specific interaction mode or task. Read the
relevant file before performing that task.

### Simplified mode (default — start here)

| Page                                | When to read                                                        |
| ----------------------------------- | ------------------------------------------------------------------- |
| `references/setup-session.md`       | Always — read first to set up the browser session                   |
| `references/simplified-debugger.md` | Running commands, extracting files, reading logs in simplified mode |

### Advanced mode (using a notebook)

| Page                                | When to read                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `references/setup-session.md`       | Always — read first to set up the browser session                                          |
| `references/advanced-debugger.md`   | **Read this BEFORE other advanced refs** — mental model, mode-switching, authorization, branches, time advancement, fault injector, host commands, common errors |
| `references/notebook.md`            | Reading or writing notebook source, injecting cells                                       |
| `references/actions.md`             | Authorizing shell actions, reading action output                                          |
| `references/common-inspections.md`  | Ready-to-use debug cell snippets for common tasks                                         |

## Recommended workflows

### Simplified: Run a command in a container

1. Read `references/setup-session.md` — open the debugger URL
2. Read `references/simplified-debugger.md` — click a log line to set the
   moment and container, enter a bash command, press Send, read the output
3. Report findings with concrete evidence

### Simplified: Extract a file

1. Read `references/setup-session.md` — open the debugger URL
2. Read `references/simplified-debugger.md` — click a log line, toggle
   "Extract file", enter the file path, press Send
3. Read the download link from the output

### Advanced: Programmatic investigation

1. Read `references/setup-session.md` — open the debugger URL and inject runtime
2. Switch to advanced mode: `window.__antithesisDebug.switchMode("advanced")`,
   then `notebook.waitForReady()`
3. Read `references/advanced-debugger.md` — internalize moments, branches,
   reactive-vs-effectful, action grouping, and common errors
4. Read `references/notebook.md` — mechanics of writing cells
5. Read `references/common-inspections.md` — ready-to-use snippets
6. Read `references/actions.md` — authorizing and reading action results
7. Report findings with evidence chain

### Download the events log for offline analysis

1. Read `references/setup-session.md` — launch / open the debugger URL
2. Read `references/download-log.md` — run `assets/download-mvd-log.sh`
   to capture and (for JSON) annotate the events log. The annotation step
   delegates to the triage skill's `process-logs.py`; no debug-skill-local
   copy.
3. Analyze the local file with `jq` (event shape matches the triage
   skill's logs reference)

## Runtime injection

The JS runtime is required for **both** simplified and advanced modes. It
provides the `window.__antithesisDebug` API with three namespaces:
`simplified`, `notebook`, and `actions`.

Use the browser-side runtime file:

- `assets/antithesis-debug.js`

Inject it into the current page with:

```bash
cat assets/antithesis-debug.js \
  | agent-browser --session "$SESSION" eval --stdin
```

Injecting the file registers methods on `window.__antithesisDebug`. Call those
methods with `agent-browser eval`.

Method call examples:

```bash
# Simplified mode
agent-browser --session "$SESSION" eval \
  'window.__antithesisDebug.simplified.runCommand("ls -la /")'

# Advanced mode
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.notebook.getSource()"
```

`agent-browser eval` awaits Promises automatically, so async and sync methods
use the same call pattern.

If `window.__antithesisDebug` is missing, inject `assets/antithesis-debug.js` and retry the method call.

Do not run method calls in parallel with `agent-browser open`, navigation, or
any other command that can replace the page. Wait until the target page is
settled before starting `eval` calls. Run queries sequentially; mutations will
interfere with each other if launched in parallel.

After every `open` call or any interaction that may navigate or replace the
page, first confirm the browser has landed on the debugger page, then inject
`assets/antithesis-debug.js` and call the appropriate `waitForReady()` before
running other methods.

## Page loading checks

After navigation, inject the runtime, then call the appropriate `waitForReady`:

```bash
# Simplified mode
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.simplified.waitForReady()"

# Advanced mode
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.notebook.waitForReady()"
```

Both poll for up to 60 seconds and return `{ ok, ready, attempts, waitedMs }`.
On timeout, the result also includes `details`.

One-shot probes:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.simplified.loadingFinished()"

agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.notebook.loadingFinished()"
```

Diagnostics:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.simplified.loadingStatus()"

agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.notebook.loadingStatus()"
```

## General guidance

- **Start in simplified mode.** The simplified debugger handles most debugging
  tasks. Only switch to advanced mode when you specifically need the notebook
  API.
- **Defer to antithesis-triage for auth.** If the debugger URL requires
  authentication, use the `antithesis-triage` skill's
  `references/setup-auth.md` for the interactive login flow. Use the same
  `--session-name antithesis` so auth state is shared.
- **Use disposable sessions.** Generate a unique `SESSION` for each debugging
  run, pair it with the shared `--session-name antithesis`, and
  `agent-browser --session "$SESSION" close` when you finish or abort.
- **Run commands sequentially.** In both modes, wait for each command to
  complete before sending the next one.
- **Do not fabricate container names.** Use the container dropdown (simplified)
  or `environment.containers.list({moment})` (advanced) to determine valid
  container names.
- **Present results clearly.** When reporting filesystem contents, include the
  full path and listing. When reporting artifact searches, include what was
  found and what was not.

### Advanced mode only

- **Inject the runtime after navigation.** After every `open` call or page
  reload, inject `assets/antithesis-debug.js` and call
  `notebook.waitForReady()` before the next method call.
- **Retry missing-runtime errors by reinjecting.** If a command fails because
  `window.__antithesisDebug` is undefined or missing, inject the runtime and
  rerun the same method.
- **Group effects with `action()` + `required_by`.** Don't authorize cells
  one at a time when a single click can fire a chain — see
  `references/advanced-debugger.md` for the `tethered_authorization`
  pattern.
- **Don't edit a command that has already been authorized.** Make a new
  branch (and new action) for the new attempt. Editing an authorized cell
  re-runs it without re-authorization (a known bug).
- **A nonzero exit code terminates the branch.** Subsequent commands on
  the same branch will fail with `CAMPAIGN SAW TERMINAL EVENT`. Fork a
  fresh branch from the same or an earlier moment.
- **Trust `cell.text`/`innerText` over `actionCompleted`.** The runtime's
  completion-detection misses real DONE states; read the cell text directly.

## Self-Review

Before declaring this skill complete, review your work against the criteria
below. This skill's output is conversational (summaries, evidence, analysis),
so the review should happen in your current context. Re-read the guidance in
this file, then systematically check each item below against the answers and
analysis you produced.

Review criteria:

- Every filesystem listing or artifact search was extracted from actual debugger output, not inferred or assumed
- The evidence chain is clear: which commands were run, what they returned, and what conclusions follow
- The summary distinguishes between what the debugger shows and what you interpret or recommend
- The browser session was closed at the end of the debugging run
