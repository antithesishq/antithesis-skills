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

## `action()` for batched authorization (pattern, untested by agent)

When you write multiple `bash\`...\`.run(...)` calls in the notebook source,
**only the first action_auth cell appears** until that action completes.
Adding 5 sequential `print(bash...run(...))` lines does not produce 5
auth-able cells up front. To probe N moments with a single authorization click, the help text describes
`action()`:

> `action`: Create a new action or action group. Actions are the boundary
> between the functional reactive world of the notebook and the effectful
> real world. Calling functions like `fetch()` creates actions internally;
> you normally call `action()` in order to group such actions into a higher
> level action group that can be authorized.

```javascript
group = action(() => {
  results = []
  for (m of [moment, moment.rewind(1.0), moment.rewind(2.0)]) {
    results.push(bash`cat /repos/sm-repo.git/refs/heads/main`.run({
      branch: m.branch(), container,
    }))
  }
  return results
})
print(group)
```

## Troubleshooting: stuck eval after `setSource`

Symptom: after overwriting the seeded notebook source with `setSource(...)`,
every cell reports `⚠ReferenceError <name> is not defined!!!` and the error
persists across page reloads. ch(), container }))

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
container = "git-server"
print(bash`...`.run({ branch: mom.branch(), container }))
```
