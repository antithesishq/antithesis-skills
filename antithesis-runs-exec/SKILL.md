---
name: antithesis-runs-exec
description: >
  Run a bash script inside an Antithesis run at a chosen moment with
  `snouty runs exec`, from the terminal and without a browser. Use it for
  scripted forensics on a run: process and container inspection, on-disk
  evidence, gdb attach, and general debugging. Covers command usage, the live-session requirement, common workflows and errors, and how virtual time and perturbation limit what a debugger can see.
compatibility: Requires snouty (https://github.com/antithesishq/snouty) with `runs exec`, and a tenant whose API supports it.
---

# `snouty runs exec`

Execute a bash script at a moment in a run. Each call branches the multiverse and repeated calls from the same moment reproduce. Can use a currently running run or an active MVD session.

This is the scripted counterpart to `antithesis-debug`, which drives the
multiverse debugger in a browser. 

## Failed Property Warning

Commands run with `runs exec` on a live run can trigger a run's assertions, which will result in a failing property that looks exactly like a real bug.

Use a debugging session if you want to avoid these kinds of false positives.
Preference using a currently running run for speed, ease of use, and less core hours for commands you do not think will cause this problem.

## When to use this skill

Prefer `runs exec` when you want repeatability, pipes, and heredocs. Prefer `antithesis-debug` when you want to explore by hand.

## Prerequisites

- Confirm your snouty build has `runs exec`: `snouty runs --help`
  must list `exec`. If it does not, install from main:
  `cargo install --git https://github.com/antithesishq/snouty --branch main --locked`.
- You must have a session from a live run or MVD session to use this command. See get a live session first for more info.
- You must be logged into an Antithesis tenant from snouty. Run `snouty doctor` to confirm. Ask your user to log you in or use an API key if you are not logged in.

## Get a live session first

- `exec` needs a live session. A session can either be tied to a run or MVD  session. In snouty both runs and debugging sessions show as runs.
- A run holds one while it runs, and for a short
  time after it ends. It will work a few minutes after completion but not hours.
- To see if a run has an active session use:

  ```bash
  snouty --json runs show <run> | jq -r .status
  ```

   A status of in_progress means you can run commands against the run. You'll also see status of starting, completed, incomplete, cancelled or unknown.
- For an older run, make a debugging session first:

  ```bash
  snouty debug --run-id <run> --input-hash <hash> --vtime <vtime> \
    --description "why you are here"
  ```

  - This returns a **new** run ID. Wait with `snouty runs wait <new run ID> --until running`, then `exec` against it.
  - Use `--source-run-id <run>` for the first command because the moment isn't warm yet. With the source, the call blocks and prints rewarming moment: N% until the moment is ready. 
  - Expect about 10 minutes from snouty debug to the first successful exec. After that, the moment is warm and later commands don't need the source. 
  - If exec answers 404 or "Moment not warm", the session is still loading. Retry. Look at get a moment to find the right input-hash and vtime for your users request.

## Get a moment (input hash and vtime)

`input-hash` and `vtime` pin the single moment to debug. Extract the input hash and vtime from context and pass them to the command.

If the user didn't give you a moment, read `references/moments.md` for where to find one.

If you can't pin down both an input hash and a vtime from a clear source, ask
the user rather than guessing.

To find a moment (input hash + vtime) from a failing property, use the
`antithesis-triage` skill.

## Required input

- `RUN_ID` is a live run, or a debugging session's run id.
- `INPUT_HASH` and `VTIME` are a moment from that run, taken together as a pair from its events, logs or properties.
- `SCRIPT` is the bash to run. Pass it as the last argument, or omit it and pipe it in, for example < script.sh.

## Optional flags

- `--timeout DURATION` takes units: `90s`, `5m`, `1h`. A bare number means seconds. The default is 10m (as of release 64.0). Any rewarm counts against it, so a cold moment may need more.
- `--container NAME` runs the script inside that container. Without it, the script runs on the host. 
- `--source-run-id ID` names the run a cold moment comes from. When the target is a debugging session, this is the run you opened the session from, not the session id. Use this flag on your first command after starting a debugging session.
- `--source-session-id ID` is the session alternative to `--source-run-id`. You can't use both.
- `--events` streams every event on the timeline while the script runs, not just the script's output.
- `--json` prints machine-readable json output.

## Execution

This command can take some time depending on the situation. See the picking a timeout section to select a good timeout.

```bash
snouty runs exec \
  "$RUN_ID" \
  "$INPUT_HASH" \
  "$VTIME" \
  --json \
  --timeout "$TIMEOUT" \
  --container "$CONTAINER" \
  --source-run-id "$SOURCE_RUN_ID" \
  --events \
  < "$SCRIPT_FILE"
```

### Execution Tips

- Use `--container` over podman exec inside the script to run a command on a single container.
- `--container` needs a container name. To list them, run the following once without `--container`, so the script runs on the host:

  ```bash
  snouty runs exec "$TARGET" "$HASH" "$VTIME" 'podman ps --format "{{.Names}}"'
  ```

  Names are the same at every moment of a run, so list them once.
- Don't use `--container` and run on host, if you need a snapshot across multiple containers.

## Run a Script from a File

- For anything longer than one line, write the script to a file and redirect it in:

  ```sh
  cat > script.sh <<'EOF'
  echo "host: $(hostname)"
  ps aux
  EOF

  snouty runs exec "$RUN_ID" "$INPUT_HASH" "$VTIME" < script.sh
  ```

  Writing the script to a file means you don't have to nest quotes on the command line. The quotes around `'EOF'` keep `$(hostname)` from running on your machine on accident.

- Reuse one script across moments. Run the same file at several moments and compare the outputs.
- Save output to a file named after the moment. 
- Always save --events output to a file. The stream is long, so grep the file afterwards:

  ```sh
  snouty runs exec --events $RUN $HASH $VTIME < oracle.sh > out.txt
  grep -E "FAIL|HIT|exit" out.txt
  ```

## Picking a Timeout and Timing

- A cold moment must be rewarmed first, and the rewarm counts against `--timeout`. The default is 10m, but a rewarm can take longer. Raise it with units, for example `--timeout 30m`.
- A timeout doesn't mean the script didn't run. Check the run's events for its output before re-running anything that changes state.
- Your script advances virtual time. Keep snapshots short. Take one query at the right moment rather than polling, because polling can change the timing you're trying to observe.
- The same command from the same moment gives the same branch. Repeating it doesn't sample new timings.
- After one exec with a source succeeds, that moment stays warm in the session. Later commands there need no source and return quickly.

## Rewarm progress

A cold moment shows progress while it rewarms. By default the command prints `rewarming moment: N%` lines on stderr. With `--json`, it prints `{"status":"rewarming","percent_complete":N}` frames on stdout, ahead of the script's output.

- No progress means the moment was warm. Progress means a rewarm ran.
- A rising percentage means the rewarm is working. Don't retry or cancel while it climbs.
- On a timeout, the last percentage shows how far the rewarm got. Progress can jump, so treat this as a rough estimate.
- The percentage can stay at 0% for several minutes and then jump to near 100%. A stall at 0% is not a failure. Leave the call running until --timeout.

## Cancel when done

Runs and debugging sessions use core hours until they end. When you are done, cancel any session you opened:

```bash
snouty runs cancel "$TARGET"
```

- Make sure you are completely done with a run or debugging session before canceling, as if you want to run more commands you will have to wait for a new session to get setup. 
- Don't cancel a run you didn't open unless the user asks.

# Example Workflow

### 1. Prerequisites

```bash
snouty runs --help | grep exec
```

### 2. Get a session

```bash
RUN=<run_id>
snouty runs show "$RUN" --json | jq -r .status
```

- `in_progress`: use the run itself. `TARGET="$RUN"`.
- `starting`: wait with `snouty runs wait "$RUN" --until running`, then use the run.
- Otherwise: pick a moment (step 3), then open a session at it and wait for it. Retry exec on 404 or "Moment not warm" while it loads.

  ```bash
  snouty debug --run-id "$RUN" --input-hash "$HASH" --vtime "$VTIME" --description "why"
  TARGET=<runId from the output>
  snouty runs wait "$TARGET" --until running
  ```

### 3. Pick a moment

```bash
read HASH VTIME <<< "$(snouty runs events "$RUN" --json -m "<error text>" -n 1 \
  | jq -r '.moment | "\(.input_hash) \(.vtime)"')"
```

### 4. Exec
Use `--source-run-id` for the first command after starting a session because the moment is still warming up. After that, the moment is warm and later commands don't need the source unless you change the moment.

```bash
cat > probe.sh <<'EOF'
hostname
ps aux | head -20
EOF

snouty runs exec "$TARGET" "$HASH" "$VTIME" --source-run-id "$RUN" < probe.sh > out.txt
```

### 5. Use the results

Apply the output to the user's goal, usually finding the cause of a bug. If the
output doesn't answer the question, exec again at an earlier moment, or from the
`end moment` line to continue forward.

If necessary give the user the moment, the script, and the relevant output, so they can rerun it.

### 6. Cancel

If you opened a session, cancel it once you are completely done running commands:

```bash
snouty runs cancel "$TARGET"
```

## gdb

To inspect a process with gdb, read `references/gdb.md`.

## Virtual time

Before choosing a moment or probing a transient event, read
`references/virtual-time.md`.

If the earlier moment isn't warm, add --source-run-id.

## Common Errors

If `exec` returns an error, read `references/errors.md`.
