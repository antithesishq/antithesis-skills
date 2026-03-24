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
