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

**Wrap every `bash...run(...)` in `print()`.** Without `print()` the call
still runs, but the return value is computed silently — no per-command
output cell appears. Pushing results into an aggregate array also hides
individual outputs; emit each `print(bash...run(...))` separately so each
command's output is its own readable cell.

### Running on the host

Use `environment.host` as the container reference for host-level commands
(this is what the simplified debugger labels `(host)` in the dropdown):

```javascript
print(
  bash`ls /opt`.run({
    branch,
    container: environment.host,
    required_by: [parent_action],
  }),
);
```

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

## Probe with a base64-packaged script

When a probe needs raw-byte escape sequences (FDB key prefixes, binary
patterns) or complex nested quoting, composing the script directly through
JS string escaping → bash → printf is fragile and easy to get wrong (a
common failure mode: `printf` interpolating `\x02` into the actual byte
0x02 before the inner tool can interpret it).

Workaround: write the script as a literal heredoc locally, base64-encode
it, and send `echo <B64> | base64 -d | bash`. Single layer of JS escaping
handles base64 cleanly.

**Simplified mode** — pack the whole probe (fdbcli + grep + summarize)
into one base64-d command so `/tmp` lifetime isn't an issue:

```bash
SCRIPT=$(cat <<'EOF'
(printf 'getrange "\\x02sm_24\\x00" "\\x02sm_24\\xff" 2000\nexit\n') \
  | fdbcli -C /etc/foundationdb/fdb.cluster > /tmp/sm24.txt 2>&1
echo "===TOTAL_FANOUT==="
grep -c 'sm_repeater_fanout' /tmp/sm24.txt
echo "===HITS_FOR_139==="
grep -E 'sm_repeater_fanout.*\\x15\\x8b' /tmp/sm24.txt || echo NO_MATCH
EOF
)
B64=$(printf '%s' "$SCRIPT" | base64 -w0)

RESP=$(agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.simplified.runCommand('echo $B64 | base64 -d | bash')")
COUNT=$(printf '%s' "$RESP" | jq -r '.outputCountBefore')
agent-browser --session "$SESSION" eval \
  "window.__antithesisDebug.simplified.waitForNewOutput($COUNT, { timeoutMs: 60000 })"
```

Note the double-backslashes inside the heredoc (`\\x02`, `\\x8b`): inside
the single-quoted EOF, bash takes them literally as the two-char sequence
`\x`; printf then preserves the backslash for the inner tool (`fdbcli`,
`grep -E`) to interpret. A common mistake is using single-backslash
(`\x02`) — printf consumes that to byte 0x02 before fdbcli sees it, and
fdbcli reports `Command failed to completely parse`.

**Advanced mode** — the same trick works inside a `bash...run`
template literal when its escape stack gets hairy:

```javascript
const SCRIPT_B64 = "KHByaW50ZiAnZ2V0cmFuZ2UgIlxceDAyc21fMjRcXHgwMCIgIlx...";
print(
  bash`echo ${SCRIPT_B64} | base64 -d | bash`.run({
    branch,
    container: "fdb-server-1",
    required_by: [parent],
  }),
);
```

## Notes

- Use `environment.containers.list({moment})` to discover available container
  names before running any commands.
- `containers` may be empty at the exact bug `moment`. Try rewinding slightly:
  `moment.rewind(Time.seconds(1))`.
- Each `bash\`...\`` invocation creates an action that requires authorization
  before it runs.
- Default timeout for `bash...run()` is 30 virtual minutes. Pass `timeout: Time.seconds(N)` for shorter timeouts.

## Time-travel sweep — probe the same container at multiple moments

### Simplified-mode sweep (preferred when you only need shell output)

The simplified runtime intentionally does NOT expose a `setMoment(vt)`
helper: the page's vtime input commits via React's `focusout` handler,
which only fires on _trusted_ (real) events. Any in-page setter would
update the display without changing the committed moment. Drive the
vtime input from agent-browser instead — find the input ref via a
snapshot, then `fill` + Tab:

```bash
# One-time: find the vtime input ref
agent-browser --session "$SESSION" snapshot -i -s "#ceres-time-input"
# => textbox [ref=e19]: ...

setMomentReal() {
  agent-browser --session "$SESSION" click @e19
  agent-browser --session "$SESSION" fill @e19 "$1"
  agent-browser --session "$SESSION" keyboard type $'\t'   # real Tab — React hears focusout
}

SCRIPT='cat /path/to/file 2>&1; stat -c "%y" /path/to/file 2>&1'
for VT in 125.0 125.7 126.5 127.5 128.0 128.5 129.0 129.5; do
  setMomentReal "$VT"
  sleep 2                # let React state settle BEFORE reading count
  COUNT=$(agent-browser --session "$SESSION" eval 'window.__antithesisDebug.simplified.getOutputCount()' \
    | python3 -c 'import sys,json; print(json.load(sys.stdin)["count"])')
  agent-browser --session "$SESSION" eval \
    "window.__antithesisDebug.simplified.runCommand($(printf '%s' "$SCRIPT" | jq -R -s .))"
  agent-browser --session "$SESSION" eval \
    "window.__antithesisDebug.simplified.waitForNewOutput($COUNT, { timeoutMs: 25000 })"
  sleep 2                # let the post-output state settle before the next iteration
done
```

**Settle times matter.** Without the `sleep 2` before AND after each
iteration, the loop alternates success/failure on a 2-cycle (every other
iteration fails with `CDP command timed out: Runtime.evaluate` or returns
a null `header`). The fresh-vtime backend compute typically takes 9–10s
inside the 25s `waitForNewOutput` window; previously-computed vtimes
return in ~2s.

Set the container once via `clickLogRow(N)` on a row from the desired
container before starting the loop (driving the vtime input does not
change the container selector). The first command after a fresh
`clickLogRow` runs in that container; the `fill`+`Tab`-driven iterations
that follow keep the same container.

### Advanced-mode sweep (preferred when you need event sets, branching, or `wait_until`)

For an absolute vtime, branch from a moment built with `rewind_to`:

```javascript
sweep_action = new action({
  description: "sweep",
  tethered_authorization: true,
});

for (vt of [15, 18, 21, 24, 27, 30]) {
  b = moment.rewind_to(vt).branch();
  print(
    bash`date && ps -elf`.run({
      branch: b,
      container: "CONTAINER",
      required_by: [sweep_action],
    }),
  );
}
```

`tethered_authorization: true` on the parent makes all `required_by`
children run from a single click on the parent's authorize button.
Without grouping, only the first child's action_auth cell would render up
front.

**`DUPLICATE_ID` from too many sibling branches.** If a tightly-clustered
sweep produces `CAMPAIGN SAW TERMINAL EVENT: 'FUZZER REJECTED CAMPAIGN ADD
WITH CODE: DUPLICATE_ID, STATUS: 400'`, the campaign fuzzer is rejecting
multiple branches off the same moment. Workarounds: space the rewinds so
each child uses a slightly different moment, or fold the sweep onto a
single branch with `wait` between commands.

See `references/advanced-debugger.md` for the full mental model, including
how `wait`/`wait_until` advance branches and the rules around terminated
branches.
