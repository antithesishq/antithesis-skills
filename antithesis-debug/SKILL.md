---
name: antithesis-debug
description: >
  Run a bash script inside an Antithesis run at a chosen moment with
  `snouty runs exec`, from the terminal and without a browser. Use it for
  scripted forensics on a run: process and container inspection, on-disk
  evidence, gdb attach, and general debugging. Covers command usage, the live-session requirement, common workflows and errors, and how virtual time and perturbation limit what a debugger can see.
compatibility: Requires snouty (https://github.com/antithesishq/snouty) with `runs exec`, and a tenant whose API supports it.
---

# Antithesis Debug

Execute a bash script at a moment in a run. Each call branches the multiverse and repeated calls from the same moment reproduce. Can use a currently running run or an active MVD session.

## When to use this skill

- The user gives you Antithesis debugging-session run ID or URL
- The user asks you to debug or investigate a failing property, bug, or any result from a past run
- The user makes a request to inspect container filesystem, runtime state, or events inside Antithesis
- The triage skill has launched an MVD session when investigating the results of a run

## Failed property warning

Commands run with `runs exec` on a live run can trigger a run's assertions, which will result in a failing property that looks exactly like a real bug.

Use a debugging session if you want to avoid these kinds of false positives.
Preference using a currently running run for speed, ease of use, and less core hours for commands you do not think will cause this problem.

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

   A status of in_progress means you can run commands against the run.
   `snouty runs wait <run> --until running` returns once `runs show` reports `in_progress`. `running` is the wait target and `in_progress` is the status it waits for, so they mean the same thing.
- If the user gives a debugging-session URL, that session may already be
  running. Find its run ID among the sessions, matching on title, description
  or creation time, and check that it is `in_progress`:

  ```bash
  snouty --json runs list --launcher debugging \
    | jq -c '{run_id, status, created_at, title: .parameters["antithesis.test_name"],
              source_run: .parameters["antithesis.debugging.run_id"]}'
  ```

  `source_run` is the value to pass to `--source-run-id`.
- For an older run, make a debugging session first:

  ```bash
  snouty debug --run-id <run> --input-hash <hash> --vtime <vtime> \
    --title "Counter property failure 2026-10-13"
  ```

  - Always pass a `--title` that is unique and easy to find later, for example the property name plus a date or ticket id. It is the name `snouty runs list` shows for the session. Add `--description` only if the reason won't fit in the title. `--recipients` takes semicolon-separated emails to notify.
  - This returns a **new** run ID. Wait with `snouty runs wait <new run ID> --until running`, then `exec` against it.
  - Use `--source-run-id <run>` for the first command because the moment isn't warm yet. With the source, the call blocks and prints rewarming moment: N% until the moment is ready. 
  - Expect 2 to 20 minutes from snouty debug to the first successful exec: a few minutes of 404s while the session loads, then a rewarm that takes longer the later the moment's vtime. After that, the moment is warm and later commands on that moment don't need the source. 
  - If exec answers 404 or "Moment not warm", the session is still loading. Retry. Look at get a moment to find the right input-hash and vtime for your users request.

## Get a moment (input hash and vtime)

`input-hash` and `vtime` pin the single moment to debug. Extract the input hash and vtime from context and pass them to the command.

If the user didn't give you a moment, read `references/moments.md` for where to find one.

If you can't pin down both an input hash and a vtime from a clear source, ask
the user rather than guessing.

To find a moment (input hash + vtime) from a failing or passing property, or
from a log line, query for it with `snouty runs search` (see step 3 of the
example workflow).

## Required input

- `RUN_ID` is a live run, or a debugging session's run id.
- `INPUT_HASH` and `VTIME` are a moment from that run, taken together as a pair from one event that `snouty runs search` returns.
- `INPUT_HASH` is often negative, for example `-1520695250096255483`. Pass it as-is: snouty reads it as the hash, not as a flag, so you don't need `--`. Adding `--` turns every flag after it into a positional argument and breaks the command.

  ```bash
  snouty runs exec "$RUN_ID" -1520695250096255483 67.7622960046865 'uptime'
  ```
- `SCRIPT` is the bash to run. Pass it as the last argument, or omit it and pipe it in, for example < script.sh.

## Optional flags

- `--timeout DURATION` is how long the server waits for the script to exit. It takes units: `90s`, `5m`, `1h`. A bare number means seconds. The default is 10m (as of release 64.0). Rewarming a cold moment does not count against it.
- `--container NAME` runs the script inside that container. Without it, the script runs on the host. 
- `--source-run-id ID` names the run a cold moment comes from. When the target is a debugging session, this is the run you opened the session from, not the session id. Use this flag on your first command after starting a debugging session.
- `--source-session-id ID` is the session alternative to `--source-run-id`. You can't use both.
- `--events` streams every event on the timeline while the script runs, not just the script's output.
- `--json` prints machine-readable json output.

### Execution Tips

- Use `--container` over podman exec inside the script to run a command on a single container.
- `--container` needs a container name, and works only on Docker Compose tests (see Kubernetes tests below). If you've already run `snouty runs search` or `snouty runs logs`, take the name from any container log event's `source.container`. Otherwise, list them by running this once without `--container`, so it runs on the host:

  ```bash
  snouty runs exec "$TARGET" "$HASH" "$VTIME" 'podman ps -a --format "{{.Names}} {{.Status}}"'
  ```

  On a Docker Compose test, names are the same at every moment of a run, so list them once.
- `--container` works only on a container that is running at your moment. If it crashed or exited earlier, `podman ps -a` shows it as `Exited`, and `--container` fails. Exec from an earlier moment when it was still up. Find one with `snouty runs search` on that container's last log lines.
- Don't use `--container` and run on host, if you need a snapshot across multiple containers.
- To get a file out of the run, print it to stdout and redirect locally:

  ```bash
  # text
  snouty runs exec "$TARGET" "$HASH" "$VTIME" --container app 'cat /var/log/app.log' > app.log

  # binary or a directory: tar + base64, then decode locally
  snouty runs exec "$TARGET" "$HASH" "$VTIME" --container app \
    'tar czf - /data/db | base64' | base64 -d > db.tgz
  ```

### Kubernetes tests

`--container` doesn't work on a Kubernetes test (the launcher in `snouty runs show`
contains "Kubernetes" or "k8s"). Leave it out and read `references/kubernetes.md`.

## Run a Script from a File

- For anything longer than one line, write the script to a file and redirect it in:

  ```sh
  cat > script.sh <<'EOF'
  echo "host: $(hostname)"
  ps aux
  EOF

  snouty runs exec "$RUN_ID" "$INPUT_HASH" "$VTIME" < script.sh
  ```

  The quotes around `'EOF'` keep `$(hostname)` from running on your machine on accident.

- Reuse one script across moments. Run the same file at several moments and compare the outputs.
- Save output to a file named after the moment. 
- Always save --events output to a file. The stream is long, so grep the file afterwards:

  ```sh
  snouty runs exec --events $RUN $HASH $VTIME < oracle.sh > out.txt
  grep -E "FAIL|HIT|exit" out.txt
  ```

## Picking a Timeout and Timing

- Size `--timeout` to the script alone. A cold moment is rewarmed first, which can take minutes (longer the later the moment's vtime), but that time doesn't count against `--timeout`. Raise it only for slow scripts, for example `--timeout 30m`.
- A timeout doesn't mean the script didn't run. Search the run for its output (`snouty runs search`) before re-running anything that changes state.
- Your script advances virtual time. Keep snapshots short. Take one query at the right moment rather than polling, because polling can change the timing you're trying to observe.
- The same command from the same moment gives the same branch. Repeating it doesn't sample new timings.
- After one exec with a source succeeds, that moment stays warm in the session. Later commands there need no source and return quickly.
- Earlier moments on the session's own timeline are warm too, so they need no rewarm.

## Rewarm progress

A cold moment shows progress while it rewarms. By default the command prints `rewarming moment: N%` lines on stderr. With `--json`, it prints `{"status":"rewarming","percent_complete":N}` frames on stdout, ahead of the script's output.

- A rising percentage means the rewarm is working. Don't retry or cancel while it climbs.
- The percentage can stay at 0% for several minutes and then jump to near 100%. A stall at 0% is not a failure. Leave the call running.

## Cancel when done

Runs and debugging sessions use core hours until they end. A debugging session doesn't end when you stop using it: by default it expires only after 6 hours. Cancel any session you opened as soon as you no longer need it, or won't need it soon:

```bash
snouty runs cancel "$TARGET"
```

- Ask a user before canceling a session. They may want to continue to use it for another debugging session when you are done.
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
- `starting`: wait with `snouty runs wait "$RUN" --until running` (returns when status is `in_progress`), then use the run.
- Otherwise: pick a moment (step 3), then open a session at it and wait for it. Retry exec on 404 or "Moment not warm" while it loads.

  ```bash
  snouty debug --run-id "$RUN" --input-hash "$HASH" --vtime "$VTIME" --title "<property> <date>"
  TARGET=<runId from the output>
  snouty runs wait "$TARGET" --until running
  ```

### 3. Pick a moment

Find moments with `snouty runs search`, and query for exactly the events you want. For example, the failing evaluations of one property:

```bash
snouty --json runs search "$RUN" \
  'filter(ev => ev.antithesis_assert?.hit
    && ev.antithesis_assert.id == "<property name>"
    && !ev.antithesis_assert.condition)' \
  | jq -r '.moment | "\(.input_hash) \(.vtime)"'
```

Drop the `!` for passing evaluations. To find a log line, use `contains({output_text: "<error text>"})`. To find an assertion by its message, use `filter(ev => ev.antithesis_assert?.message?.includes("<message text>"))`. Assertions have no `output_text`, so the log-line query won't find them. See `references/moments.md`.

`runs search` returns at most 50 results by default. Add `--limit 999` if you need more than a few.

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

If you opened a session, ask a user if they want you to cancel the run once you are done running commands. Otherwise it keeps using core hours until it expires after 6 hours:

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

## Self-Review

Before reporting back, check your work against these criteria:

- Every finding comes from actual `exec` output, not inferred or assumed.
- The evidence chain is clear: the moment (input hash and vtime), the script, what it returned, and what follows from it.
- The summary separates what the output shows from what you interpret or recommend.
- You've asked the user if you should cancel any debugging session you opened, or the user knows it is still running.

## Known issues

- `exec` can still return 404 for several minutes after `snouty runs wait --until running` returns. Keep retrying; the session is still loading.
- After `snouty runs cancel`, the run's status may show `completed` instead of `cancelled`. The cancel worked.
