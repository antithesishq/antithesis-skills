# Notebook Interaction

The debugger page is a notebook backed by a live Monaco editor, not a static
report. Code changes trigger notebook recalculation.

## Reading the notebook

Get the full editor source:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.notebook.getSource()"
```

Returns `{ ok, source, length }`.

Get all rendered cells with their outputs:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.notebook.getCells()"
```

Each cell includes `index`, `text`, `hasAction`, `output`, `code`, and
`visible`.

> **Cell `text` is truncated at 500 chars** by the runtime's `clean()`
> helper. If a cell's rendered output is long (help text, an event listing,
> a long file dump), `getCells()` will silently cut it. To read the full
> content of a specific cell, query the DOM directly:
>
> ```bash
> agent-browser --session "$SESSION" eval '(() => {
>   const cells = document.querySelectorAll(".cell");
>   return (cells[INDEX].innerText || "").trim();
> })()'
> ```

## Writing to the notebook

Replace the entire editor source:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.notebook.setSource('print(\"hello\")')"
```

Append code to the end of the editor:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.notebook.appendSource('\\n// new cell\\nprint(42)')"
```

Under the hood both `setSource` and `appendSource` call
`window.editor.setValue(...)`. Monaco recompiles on value change and the
debugger's notebook re-evaluates affected cells. **Allow 5–10 seconds for
new cells to render** after a large source replacement; small appends
typically settle within ~2s.

For complex multi-line code, use `eval --stdin` or construct the string with a
helper to avoid shell quoting issues:

```bash
agent-browser --session "$SESSION" eval '(() => {
  const e = window.editor;
  const src = e.getValue();
  const bt = String.fromCharCode(96);
  const tail =
    "\n// inspect\n" +
    "inspect_branch = moment.branch()\n" +
    "print(bash" + bt + "pwd && ls -la /" + bt + ".run({branch: inspect_branch, container: container}))\n";
  e.setValue(src + tail);
  return true;
})()'
```

## Default notebook model

The seeded notebook typically contains:

```javascript
[environment, moment] = prepare_multiverse_debugging()
print(environment.events.up_to(moment))
print(containers = environment.containers.list({moment}))
print(environment.fault_injector.get_settings({moment})?.faults_paused)
container = containers[0]?.name ?? "foo"
branch = moment.branch()
print(bash`echo "hello" > /tmp/world && echo done`.run({branch, container}))
```

Important:
- `containers` may be empty at the exact bug `moment` — try `moment.rewind(Time.seconds(1))`
- The seeded notebook assigns `container = containers[0]?.name` — use that variable in your injected cells
- Actions (shell commands via `bash\`...\``) do not run until explicitly authorized
- Bare assignments (no `var`/`let`/`const`) create notebook globals accessible across cells
- Variables declared with `var`/`let`/`const` remain local to their cell

## Checking editor status

One-shot readiness probe:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.notebook.loadingFinished()"
```

Diagnostic status if things look wrong:

```bash
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.notebook.loadingStatus()"
```

Low-level window probes for debugging:

```bash
agent-browser --session "$SESSION" eval \
  'Object.keys(window).filter(k => /editor|notebook/i.test(k))'
```

## `action()` for batched authorization

When you write multiple `bash\`...\`.run(...)` calls in the notebook source,
**only the first action_auth cell appears** until that action completes.
Adding 5 sequential `print(bash...run(...))` lines does not produce 5
auth-able cells up front.

To probe N moments with a single authorization click, create a parent
`action()` and link each effect to it via `required_by` (the parent runs
its children when authorized, thanks to `tethered_authorization: true`):

```javascript
parent = new action({ description: "sweep", tethered_authorization: true })

for (m of [moment, moment.rewind(1.0), moment.rewind(2.0)]) {
  print(bash`cat /path/to/file`.run({
    branch: m.branch(),
    container,
    required_by: [parent],
  }))
}
```

> **Do not pass a function to `action()`** — the legacy form
> `action(() => { ... })` is no longer accepted and prints
> `⚠ action(...) expects: ✘ props : ✘ Optionally : ...`. The current
> `action()` takes only an opts object. Do the work in regular cells linked
> by `required_by`.

Action props you'll use:

- `description: string` — button label.
- `required_by?: Action[]` — declare this as a child of another action.
- `tethered_authorization?: boolean` — set on a parent so children fire
  when the parent is authorized.

The on-page schema lists more props (`display_ui`, `ready`, `when`) used for
non-interactive notebook automation; agentic sessions don't need them. Pass
a garbage opts object if you ever need to see the full schema — the
notebook will print a `⚠ action(...) expects: ...` warning listing every
prop.

See `references/advanced-debugger.md` for the full grouping pattern and
common errors (e.g., `DUPLICATE_ID` from too many sibling branches).

## Troubleshooting: stuck eval after `setSource`

Symptom: after overwriting the seeded notebook source with `setSource(...)`,
every cell reports `⚠ReferenceError <name> is not defined!!!` and the error
persists across page reloads.

Even though `prepare_multiverse_debugging()` directly returned a valid
`[Environment, Moment]` tuple when assigned to a single variable in the
same source, the destructured names (`environment`, `moment`) failed to
bind.

**Workaround that cleared the stuck state**: replace the destructuring with
separate assignments:

```javascript
notebook_version(2, true)
_t = prepare_multiverse_debugging()
env = _t[0]
mom = _t[1]
container = "CONTAINER"
print(bash`...`.run({ branch: mom.branch(), container }))
```
