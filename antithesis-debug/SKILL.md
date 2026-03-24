---
name: antithesis-debug
description: >
  Use this skill to interactively debug Antithesis test runs using the
  multiverse debugger notebook. Open a debugging-session URL, inspect container
  filesystems and runtime state, inject shell commands, and extract evidence
  from inside the Antithesis environment. Covers notebook interaction, action
  authorization, filesystem inspection, and runtime investigation.
keywords:
  - antithesis
  - debugger
  - multiverse
  - debugging session
  - notebook
  - container
  - filesystem
  - runtime
  - inspect
  - shell
---

# Antithesis Multiverse Debugger

Use the `agent-browser` skill to interact with the Antithesis multiverse
debugger notebook.

Every debugging session should use:

- a fresh, unique `SESSION` value such as `antithesis-debug-$(date +%s)-$$`

Use `--session-name antithesis` so `agent-browser` manages shared
authentication state automatically, while `--session "$SESSION"` keeps each
debugging run isolated from other concurrent agents. Close the unique live
session when debugging is complete.

## When to use this skill

Use this when the user gives:

- an Antithesis debugging-session URL
- a bug report URL that should be debugged interactively
- a request to inspect container filesystem, runtime state, or events inside Antithesis

For auth and report navigation, use the `antithesis-triage` skill. It already
encodes the right `agent-browser` session model. This skill handles the
debugger notebook itself.

## Gathering user input

Before starting, collect the following from the user:

1. **Debugger URL** (required) — A tokenized debugging-session URL like `https://TENANT.antithesis.com/debugging-session/...`. Tokenized URLs work without interactive login.
2. **What to investigate** — Are they checking filesystem contents? Runtime state? Specific artifacts? This determines which inspection cells to inject.
3. **Container name** (if known) — The name of the container to target. If not provided, the notebook's `environment.containers.list({moment})` can discover available containers.

## Reference files

Each reference file contains the commands and patterns for a specific task.
Read the relevant file before performing that task.

| Page                               | When to read                                        |
| ---------------------------------- | --------------------------------------------------- |
| `references/setup-session.md`      | Always — read first to set up the browser session   |
| `references/notebook.md`           | Reading or writing notebook source, injecting cells |
| `references/actions.md`            | Authorizing shell actions, reading action output    |
| `references/common-inspections.md` | Ready-to-use debug cell snippets for common tasks   |

## Runtime injection

Use the browser-side runtime file:

- `assets/antithesis-debug.js`

Inject it into the current page with:

```bash
cat assets/antithesis-debug.js \
  | agent-browser --session "$SESSION" eval --stdin
```

Injecting the file registers methods on `window.__antithesisDebug`. Call those
methods with `agent-browser eval`.

Method call pattern:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.notebook.getSource()"
```

`agent-browser eval` awaits Promises automatically, so async and sync methods
use the same call pattern.

If `window.__antithesisDebug` is missing, inject `assets/antithesis-debug.js` and retry the method call.

Do not run method calls in parallel with `agent-browser open`, navigation, or
any other command that can replace the page. Wait until the target page is
settled before starting `eval` calls. On a single browser session, run notebook
queries sequentially; editor mutations and action authorization will interfere
with each other if launched in parallel.

After every `open` call or any interaction that may navigate or replace the
page, first confirm the browser has landed on the debugger page, then inject
`assets/antithesis-debug.js`, then call `notebook.waitForReady()` before
running other methods.

## Page Loading Checks

After navigation, verify the browser is on the debugger page, inject the
runtime, then call the wait method before running page-specific queries.

```bash
agent-browser --session "$SESSION" eval 'document.title'
```

Then wait for the notebook to be ready:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.notebook.waitForReady()"
```

The wait method polls for up to 60 seconds and returns a result object with
`ok`, `ready`, `attempts`, and `waitedMs`. On timeout, the result also includes
`details`.

Use the lower-level boolean check when you need a one-shot probe:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.notebook.loadingFinished()"
```

If the notebook does not become ready, inspect:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.notebook.loadingStatus()"
```

## Recommended workflows

### Inspect container filesystem

1. Read `references/setup-session.md` — open the debugger URL
2. Read `references/notebook.md` — read the seeded notebook to understand available variables
3. Read `references/common-inspections.md` — pick the right inspection cell
4. Read `references/actions.md` — authorize the action and read the result
5. Report the findings with concrete evidence from the container

### Investigate a specific artifact

1. Read `references/setup-session.md` — open the debugger URL
2. Read `references/notebook.md` — read the seeded notebook, then inject a targeted search cell
3. Read `references/actions.md` — authorize and read the result
4. Based on the result, inject follow-up cells as needed
5. Report findings with the evidence chain

### General exploration

1. Read `references/setup-session.md` — open the debugger URL
2. Read `references/notebook.md` — read the seeded notebook to understand `environment`, `moment`, and `containers`
3. Inject exploration cells one at a time, authorizing and reading each result before proceeding
4. Only after getting concrete runtime evidence, form hypotheses about the issue

## General guidance

- **Defer to antithesis-triage for auth.** If the debugger URL requires
  authentication beyond its token, use the `antithesis-triage` skill's
  `references/setup-auth.md` for the interactive login flow. Use the same
  `--session-name antithesis` so auth state is shared.
- **Use disposable sessions.** Generate a unique `SESSION` for each debugging
  run, pair it with the shared `--session-name antithesis`, and
  `agent-browser --session "$SESSION" close` when you finish or abort.
- **Inject the runtime after navigation.** After every `open` call or page
  reload, inject `assets/antithesis-debug.js` and call
  `notebook.waitForReady()` before the next method call.
- **Retry missing-runtime errors by reinjecting.** If a command fails because
  `window.__antithesisDebug` is undefined or missing, inject the runtime and
  rerun the same method.
- **Run queries sequentially.** Editor mutations and action authorization change
  page state. Do not overlap them.
- **Authorize actions one at a time.** Each `bash\`...\`` cell needs explicit
  authorization. Read the result before injecting the next cell.
- **Do not fabricate container names.** Use `environment.containers.list({moment})`
  or evidence from the triage report to determine valid container names.
- **Present results clearly.** When reporting filesystem contents, include the
  full path and listing. When reporting artifact searches, include what was
  found and what was not.

## Self-Review

Before declaring this skill complete, review your work against the criteria
below. This skill's output is conversational (summaries, evidence, analysis),
so the review should happen in your current context. Re-read the guidance in
this file, then systematically check each item below against the answers and
analysis you produced.

Review criteria:

- Every filesystem listing or artifact search was extracted from actual debugger output, not inferred or assumed
- Container names used in commands were verified against `environment.containers.list({moment})` or report evidence
- Action cells were authorized before reading their output — no output was fabricated
- The evidence chain is clear: which cells were injected, what they returned, and what conclusions follow
- The summary distinguishes between what the debugger shows and what you interpret or recommend
- The browser session was closed at the end of the debugging run
