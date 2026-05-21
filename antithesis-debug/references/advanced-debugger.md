# Advanced Notebook Debugger

The advanced mode replaces the simplified command box with a live JavaScript
notebook backed by Monaco. Code in the notebook is reactive: editing a cell
recomputes everything that depends on it. The notebook is the right tool when
you need branching, time advancement, event-set filtering, fault-injector
control, or programmatic multi-step workflows.

**Read this file before doing any work in advanced mode.** The other advanced-
mode references (`notebook.md`, `actions.md`, `common-inspections.md`) cover
specific mechanics; this page covers the mental model and the workflow rules
agents have to follow to avoid landing in confusing states.

## Mental model

The notebook exposes a small set of top-level names defined by
`prepare_multiverse_debugging()`:

- **`moment`** — the immutable point in virtual time where the bug was caught.
- **`environment`** — entrypoint to the system: `environment.events`,
  `environment.containers`, `environment.host`, `environment.fault_injector`,
  `environment.session`, `environment.session.events`, `environment.session.output`,
  `environment.extract_file`, ...
- **`bash`** — tagged template literal. `bash\`echo hi\`` builds an action.
- **`action()`** — wraps work so it can be authorized together (see below).
- **`print()`** — emits a value into a visible cell. Without `print()`, a
  return value is computed but never shown.
- **`help(thing)`** — short blurb. Often less useful than the schema-discovery
  trick below.
- **`Time.seconds(n)`** — durations for `wait`, `wait_until`, `timeout`.

Two derived concepts that you must internalize:

- A **Moment** is a snapshot. Immutable. Identified by a vtime + the hash of
  all inputs leading up to it.
- A **Branch** is a mutable timeline rooted at some moment. Operations on a
  branch advance it. `branch.end` is the moment at the current tip.

Most operations take a branch and mutate it (`bash...run({branch, ...})`,
`branch.wait(...)`, `branch.wait_until(...)`). A few take a moment and
produce immutable values (`environment.events.up_to(moment)`,
`environment.containers.list({moment})`).

## Reactive vs. effectful — when authorize is required

The notebook has two categories of operation, and the distinction is the
whole reason for action authorization:

- **Reactive (no authorize button).** Pure derivations from already-known
  state. Update automatically when their inputs change. Examples:
  `environment.events.up_to(branch)` — when the branch tip moves, the cell
  recomputes. No new probe; no action.
- **Effectful (authorize button).** Touch the real system: probe live state,
  run a process, change settings. Each call produces an action cell that
  must be clicked to run. Examples: `bash...run(...)`,
  `bash...run_in_background(...)`, `environment.extract_file(...)`,
  `environment.containers.list({moment})` (because it queries podman),
  `environment.fault_injector.pause/unpause/update_settings(...)`.

Rule of thumb: if the value comes from inspecting event/log data the system
already produced, it is reactive. If it requires a new probe of the running
system, or has a co-effect on something outside the notebook, it is an action.

## Switching to advanced mode

There are two distinct things both called "mode":

- **Page-level mode** — controlled by `window.__antithesisDebug.switchMode("advanced")`.
  This is what `getMode()` reports. Switches the right pane between the
  simplified command box and the notebook editor.
- **Display tab** — the strip at the top with "Simple mode" / "Advanced mode"
  tabs. This is a SEPARATE control over the right pane's contents, and
  `switchMode()` does NOT click it. They can disagree (`getMode()` returns
  `"advanced"` while the "Simple mode" tab is the active one).

To enter advanced mode programmatically:

```bash
agent-browser --session "$SESSION" eval 'window.__antithesisDebug.switchMode("advanced")'
agent-browser --session "$SESSION" eval 'window.__antithesisDebug.notebook.waitForReady()'
```

## On-page advanced-mode help — read this first

There is a substantial built-in help panel (~5KB) covering the notebook
fundamentals: cells, print, moments, branches, event sets, environment, and
common workflows. It is hidden behind the "Advanced mode" display tab. To
read it without scrolling the UI:

```bash
# Click the "Advanced mode" tab in the display strip
agent-browser --session "$SESSION" eval '(() => {
  const tabs = document.querySelectorAll(".display_area__tab");
  for (const t of tabs) {
    if ((t.innerText || "").trim() === "Advanced mode") { t.click(); return true; }
  }
  return false;
})()'

# Read its content
agent-browser --session "$SESSION" eval 'document.querySelector(".display_area__layout").innerText'
```

This panel is more canonical than scraping `help()` cells in the notebook
(the runtime truncates cell text at 500 chars; the panel returns the whole
thing).

## Writing notebook cells

The notebook source lives in `window.editor`. The runtime exposes
`notebook.getSource()`, `notebook.setSource(code)`, `notebook.appendSource(code)`
— but these all reduce to `editor.setValue(...)`. Monaco recompiles on value
change; allow **5–10 seconds** for a large source replacement to render new
cells.

Cells are separated by blank lines. Each cell is JavaScript. Important
language quirks:

- Bare assignments (`x = 1`) create notebook globals visible to other cells.
- `var`/`let`/`const` declarations remain local to their cell.
- `print(expr)` emits a visible cell. `print(x = 1+2)` both assigns and
  displays.

To make a result visible, **wrap every `bash...run(...)` and every value you
want to see in `print()`**. Pushing results into an aggregate array hides
the individual outputs; print each one separately for readable cells.

For complex multi-line code, prefer writing it to a file and stdin-piping:

```bash
cat > /tmp/cell.js <<'EOF'
(() => {
  const e = window.editor;
  e.setValue(e.getValue() + `
my_action = new action({description: "demo"})
my_branch = moment.rewind_to(15.0).branch()
print(bash\`date\`.run({branch: my_branch, container: "CONTAINER", required_by: [my_action]}))
`);
  return { len: e.getValue().length };
})()
EOF
cat /tmp/cell.js | agent-browser --session "$SESSION" eval --stdin
```

## Actions, authorization, and grouping

Each effectful call materializes an action cell with an authorize button.
By default, **only the first un-authorized action's cell renders its button**.
Adding five `print(bash...run(...))` calls in source does not produce five
buttons up front — subsequent ones appear after the prior completes.

To group multiple effects under one authorize click, use `action()` to make
a parent and link children with `required_by`:

```javascript
parent = new action({ description: "sweep", tethered_authorization: true })

print(bash`date`.run({
    branch: my_branch, container: "CONTAINER",
    required_by: [parent],
}))

print(bash`ls -la /`.run({
    branch: my_branch, container: "CONTAINER",
    required_by: [parent],
}))
```

Action props you'll use:

- `description: string` — button label (defaults to the underlying op name).
- `required_by?: Action[]` — mark THIS action as a child of another.
- `tethered_authorization?: boolean` — children run when this parent has
  been authorized. Set this on the parent.

If you ever want to see the full list, pass a garbage opts
object — the notebook prints a `⚠ action(...) expects: ...` warning
listing every prop (see "schema-discovery" below).


### The schema-discovery trick ("expect" pattern)

Any time you don't know what arguments a function accepts, **call it with a
deliberately wrong well-formed object**. The notebook will print a
`⚠ functionName(...) expects: ...` cell listing the expected props. This is
how `update_settings`, `action`, `bash.run`, `wait`, `wait_until`, etc., all
self-document. Don't waste time on `help(foo)` for callables — pass garbage
and read the warning.

## Moments and branches

```javascript
// Make a new moment at an absolute vtime (rewinds backward from `moment`)
m = moment.rewind_to(15.0)

// Relative rewind (n seconds earlier than the current moment)
m2 = moment.rewind(Time.seconds(3))

// Create a mutable branch rooted at a moment
b = m.branch()
b.end                   // the moment at the current branch tip

// Advance time on the branch without running a command
b.wait({duration: Time.seconds(5), required_by: [parent]})

// Advance until a matching event occurs (or until 1800s elapse — default cap)
b.wait_until({
    until: environment.session.output.contains({source: "fault_injector"}),
    required_by: [parent],
})
```

A few things to internalize:

- **Commands advance the branch.** Each `bash...run({branch, ...})` extends
  the branch's timeline by the duration the command actually takes —
  empirically ~50–80 ms per call for a typical short shell command (an
  `fdbcli getrange` + a few `grep`s). Subsequent commands run from the
  new tip. To inspect state at exactly vtime X, rewind to X − 0.005 or
  so, so the actual probe-execution time lands near (not past) X.
- **Without a wait, the SUT is frozen.** Between your commands, no
  simulated time passes. `wait` and `wait_until` are how you let the SUT
  run for a duration so background activity (fault injector, timers,
  scheduled work) can happen.
- **A nonzero exit code terminates the branch.** Any subsequent command on
  the same branch produces
  `CAMPAIGN SAW TERMINAL EVENT: 'RUN BASH COMMAND: ...' EXITED WITH
  NONZERO EXIT CODE N'`. You cannot "undo" the termination — make a fresh
  branch from the same (or an earlier) moment.

  **`grep` is the most common landmine.** `grep PATTERN file` returns exit
  1 on no match, which terminates the branch even though the probe
  "worked." Wrap any terminal `grep` (or `find`, or anything else that
  may legitimately return nonzero) with `|| true` or `|| echo
  not-found` so the script always exits 0:

  ```bash
  grep 'sm_repeater_fanout' /tmp/sm24.txt | head -1 || echo NO_FANOUT
  ```

### Time travel — sweeping multiple moments

```javascript
sweep_action = new action({description: "sweep", tethered_authorization: true})
for (vt of [15, 18, 21, 24, 27, 30]) {
  b = moment.rewind_to(vt).branch()
  print(bash`date && ps -elf`.run({
      branch: b, container: "CONTAINER",
      required_by: [sweep_action],
  }))
}
```

If you mass-branch like this and get `CAMPAIGN SAW TERMINAL EVENT: 'FUZZER
REJECTED CAMPAIGN ADD WITH CODE: DUPLICATE_ID, STATUS: 400'`, the campaign
fuzzer is rejecting too many sibling branches off the same moment. Work
around by spacing the rewinds slightly (different moments per child) or by
doing the sweep on a single branch with `wait` in between.

## Running commands on the host

`environment.host` is the special container reference for the host. It is
what the simplified debugger labels `(host)` in the dropdown.

```javascript
print(bash`ls -laf /opt`.run({
    branch: my_branch,
    container: environment.host,
    required_by: [parent],
}))
```

## Exploring alternate histories with `send_input`

From the same moment, a `wait()` always produces the same history (the
simulator is deterministic). To explore *different* random histories from
the same moment — e.g. to try to recreate a specific event after making a
change, or to compare what could have happened — use `send_input` on the
branch instead of (or before) `wait`.

```js
branch.send_input({input_bytes: [1, 2, 3, 4], required_by: [parent]})
```

Each value in `input_bytes` is a byte that represents approximately one
second of run time and tweaks the random number seed as it is consumed.
Choose the bytes at random. A typical recipe to enter a fresh history is:
`send_input` a few bytes, then `wait` for the duration you actually want
to observe. Each different combination of bytes produces a unique
history.

## Background processes and process events

```javascript
print(p = bash`sleep 3 && echo done`.run_in_background({
    branch: b,
    container: "CONTAINER",
    required_by: [parent],
}))

// Without doing anything, `p` sits frozen — the SUT does not advance.
// Use a wait or wait_until to let it run.
b.wait_until({until: p.exits, required_by: [parent]})
```

The process object `p` exposes event sets like `p.exits` (a `FlatMapEventSet`
that matches the specific process's exit event). The rule is the same:
without an explicit advance, the backgrounded work makes no progress.

## Event sets

`environment.events` and `environment.session.output` are predefined event
sets. They are "lenses" — abstract queries you compose by filtering, then
evaluate by calling `up_to(moment_or_branch)`:

```javascript
// All output events where source is "fault_injector", up to the branch tip
print(environment.session.output.contains({source: "fault_injector"}).up_to(b))
```

Two useful refinements:

- `.contains({source: "fault_injector"})` matches the entire fault_injector
  subsystem — actual fault injections AND metrics AND control messages
  (pause/unpause status). To see only real faults, filter more tightly
  (try `.contains({source: "fault_injector", "fault.name": "partition"})`
  and use the schema-discovery trick if the filter shape is wrong).
- Passing a branch to `up_to` makes the cell reactive to that branch's tip
  — when commands advance the branch, the events cell recomputes
  automatically.

## Fault injector control

`environment.fault_injector` provides:

```javascript
environment.fault_injector.pause({branch: b, required_by: [parent]})
environment.fault_injector.unpause({branch: b, required_by: [parent]})
environment.fault_injector.update_settings({
    parameters: { /* ... */ },
    branch: b,
    settings: { /* ... */ },     // optional
    required_by: [parent],
})
```

Under the hood, `pause` and `unpause` schedule a backgrounded
`fault_injector_update --pause --description=...` command on the host; they
show up as a nested `Run bash command in background:` cell. The
`update_settings` signature is best discovered via the schema-discovery
trick — pass `{}` and read the warning.

A paused branch will still emit fault_injector METRICS and guest-state events
during a `wait`. Real fault injections (events with payload
`{fault:{...name:partition...}}`) DO stop. If you look at a paused window
and see fault_injector entries anyway, check the event payload.

## Workflow rules

These are project-team conventions, not just suggestions:

1. **Don't edit a command that has already been authorized.** If a command
   needs to change after authorize, either make a new branch+action for
   the new attempt, or use a fresh action. Editing the source of an
   already-authorized cell will cause it to re-run without re-authorization
   (a known bug). Correcting typos in not-yet-authorized cells is fine.
2. **Each `bash...run(...)` should be wrapped in `print()`** so the result
   appears in its own visible cell.
3. **One nonzero exit poisons the branch.** Don't keep adding commands to
   a terminated branch — fork a new one.
4. **Multiple branches off the same moment are independent.** This is a
   feature: you can pause faults on one branch, leave them active on
   another, and compare.
5. **Don't trust `actionCompleted` from the runtime.** It under-reports
   completion (returns `false` while the cell text clearly shows "DONE").
   Read the cell's text instead (`notebook.getCells()` truncates at 500
   chars — fall back to DOM `cell.innerText` for full content).

## Reading results

```bash
# Snapshot of all cells (text truncated at 500 chars per cell)
agent-browser --session "$SESSION" eval 'window.__antithesisDebug.notebook.getCells()'

# Full text of a specific cell from the DOM (no truncation)
agent-browser --session "$SESSION" eval '(() => {
  const cells = document.querySelectorAll(".cell");
  return (cells[INDEX].innerText || "").trim();
})()'

# List of action cells with their auth/completion state
agent-browser --session "$SESSION" eval 'window.__antithesisDebug.actions.getAll()'
```

When a `bash...run(...)` cell is DONE, its output is rendered as a sequence
of event lines, each prefixed with the simulated vtime at which the line
was emitted:

```
Run bash command: date
DONE
1 item
16.023  Wed May 13 16:19:12 UTC 2026
```

The vtime on the output line tells you when the command actually executed
on the branch. Wall-clock `date` correlates 1:1 with simulated vtime — the
simulator's clock advances in lock-step.

## When the page errors out

If the browser tab hits `chrome-error://chromewebdata/` or `document.title`
no longer matches the debugger, the runtime is gone. Reopen the URL in the
same `--session`:

```bash
agent-browser --session "$SESSION" open "$URL"
agent-browser --session "$SESSION" wait --load networkidle
cat assets/antithesis-debug.js | agent-browser --session "$SESSION" eval --stdin
agent-browser --session "$SESSION" eval 'window.__antithesisDebug.notebook.waitForReady()'
```

Notebook source and authorized-action history have, empirically, survived
crash+reload (probably persisted server-side by the debug session URL).
Don't rely on this — always be prepared to re-inject any custom cells.

## Common error messages

| Status / message | What it means | What to do |
|---|---|---|
| `CAMPAIGN SAW TERMINAL EVENT: '... EXITED WITH NONZERO EXIT CODE N'` | A command on this branch failed | Make a new branch; the old one is terminated |
| `CAMPAIGN SAW TERMINAL EVENT: 'FUZZER REJECTED CAMPAIGN ADD WITH CODE: DUPLICATE_ID, STATUS: 400'` | Too many sibling branches off the same moment | Vary the moments (different `rewind_to` values) or fold into one branch |
| `UNKNOWN START MOMENT` | An action references a moment/branch/event set that hasn't been materialized (e.g., `wait_until(p.exits)` when `p` was never run) | Authorize the upstream action first, or fix the dependency |
| `⚠ FOO(...) expects: ...` | You passed FOO a wrong-shaped argument | Read the listed props and supply them. Use this same trick deliberately to discover unknown APIs. |
| `Get events up to undefined` | The branch passed to `up_to` has no end yet (no commands have run on it) | Authorize at least one effect on the branch, or use a concrete moment |
