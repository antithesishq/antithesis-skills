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
