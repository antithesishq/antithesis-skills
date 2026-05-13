# Common Inspections

Inject these into the notebook using
`window.__antithesisDebug.notebook.appendSource(...)` or direct
`window.editor.setValue(...)` calls (see `references/notebook.md`).

After injecting, authorize the resulting action cell and read the output (see
`references/actions.md`).

In all snippets below, replace `CONTAINER` with the actual container name
discovered from `environment.containers.list({moment})` or from triage report
evidence.

## Discover available containers

Always run this first to find valid container names:

```javascript
print((containers = environment.containers.list({ moment })));
```

This returns an array with each container's `name`, `id`, `state`, `image`,
and `image_id`.

## Running a shell command

Fork a branch from the bug moment and run a bash command in a container:

```javascript
branch = moment.branch();
print(bash`YOUR COMMAND HERE`.run({ branch, container: "CONTAINER" }));
```

The `bash` tagged template literal supports JavaScript interpolation. The
`.run()` call is synchronous — it advances the branch timeline until the
command exits. Use any shell command you need; the agent can compose these
freely.

## Extract a file for download

```javascript
link = environment.extract_file({
  moment,
  path: "/path/to/file",
  container: "CONTAINER",
});
print(link);
```

## Check fault injection state

```javascript
print(environment.fault_injector.get_settings({ moment })?.faults_paused);
```

## View events leading up to the bug moment

```javascript
print(environment.events.up_to(moment));
```

## Peek into the future

Branch from the moment and advance time to see what happens next:

```javascript
branch = moment.branch();
branch.wait(Time.seconds(5));
print(environment.events.up_to(branch));
```

## Run a command with a timeout

```javascript
branch = moment.branch();
print(
  bash`COMMAND`.run({
    branch,
    container: "CONTAINER",
    timeout: Time.seconds(10),
  }),
);
```

## Run a command in the background

```javascript
branch = moment.branch();
print(
  bash`COMMAND`.run_in_background({
    branch,
    container: "CONTAINER",
  }),
);
branch.wait(Time.seconds(10));
```

Background execution advances the branch only until command delivery, not
completion.

## Notes

- Use `environment.containers.list({moment})` to discover available container
  names before running any commands.
- `containers` may be empty at the exact bug `moment`. Try rewinding slightly:
  `moment.rewind(Time.seconds(1))`.
- Each `bash\`...\`` invocation creates an action that requires authorization
  before it runs.
- Default timeout for `bash...run()` is 30 virtual minutes. Pass`timeout: Time.seconds(N)` for shorter timeouts.


## Time-travel sweep — probe the same container at multiple moments

### Simplified-mode sweep (preferred when you only need shell output)

Preferred when you don't need branch arithmetic. Uses `setMoment` to fires the input's
`focusout` handler to commit the new moment.

Example: 

```bash
SCRIPT='cat /repos/sm-repo.git/refs/heads/main 2>&1; stat -c "%y" /repos/sm-repo.git/refs/heads/main 2>&1'
for VT in 125.0 125.7 126.5 127.5 128.0 128.5 129.0 129.5; do
  agent-browser --session "$SESSION" eval \
    "window.__antithesisDebug.simplified.setMoment($VT)"
  COUNT=$(agent-browser --session "$SESSION" eval \
    'window.__antithesisDebug.simplified.getOutputCount().count' \
    | grep -oE '[0-9]+' | tail -1)
  agent-browser --session "$SESSION" eval \
    "window.__antithesisDebug.simplified.runCommand($(printf '%s' "$SCRIPT" | jq -R -s .))"
  agent-browser --session "$SESSION" eval \
    "window.__antithesisDebug.simplified.waitForNewOutput($COUNT, { timeoutMs: 30000 })"
  agent-browser --session "$SESSION" eval \
    'window.__antithesisDebug.simplified.getLastOutput()'
done
```
Make sure to set the container once via the dropdown before starting the loop.

### Advanced-mode sweep (when you need event sets, branching, or `wait_until`)

For each time you want to travel to, position the branch to that time: 

```js
branch = moment.rewind_to($TIME).branch()
```

Each `bash\`...\`.run(...)` is its own action that requires explicit
authorization. Critically, **only the first action in source order
materializes as an `action_auth` cell** — subsequent ones do not appear until
the prior completes, so a naive print sweep won't all auto-show. Two
options:

1. Edit source to one probe at a time, authorize, read result, edit again.
   Slow but reliable.
2. Use `action()` to group multiple `bash\`...\`.run(...)` calls under a
   single authorize click. See `notebook.md` for the `action()` pattern.

**Pitfall observed:** after using `setSource` to write a fresh notebook with
`[environment, moment] = prepare_multiverse_debugging()`, all cells reported
`ReferenceError: environment is not defined` and didn't clear on reload.
Switching to separate assignments (`_t = prepare_multiverse_debugging(); env
= _t[0]; mom = _t[1]`) cleared it. See `notebook.md` Troubleshooting.
