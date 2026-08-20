---
name: antithesis-runs-exec
description: >
  Run a bash script inside an Antithesis run at a chosen moment with
  `snouty runs exec`, from the terminal and without a browser. Use it for
  scripted forensics on a run: process and container inspection, on-disk
  evidence, and gdb attach. Covers the live-session requirement, where the
  script lands, and how virtual time and perturbation limit what a debugger
  can see.
compatibility: Requires snouty (https://github.com/antithesishq/snouty) with the `runs-exec` unstable feature, and a tenant whose API supports it.
---

# `snouty runs exec`

Execute a bash script at a moment in a run. Each call branches the multiverse,
so it does not disturb the original run, and repeated calls from the same
moment reproduce.

This is the scripted counterpart to `antithesis-debug`, which drives the
multiverse debugger in a browser. Prefer `runs exec` when you want
repeatability, pipes, and heredocs. Prefer `antithesis-debug` when you want to
explore by hand.

## Setup

- The command is gated. Set `SNOUTY_UNSTABLE_FEATURES=runs-exec`.
- Confirm your build has it: `SNOUTY_UNSTABLE_FEATURES=runs-exec snouty runs --help`
  must list `exec`. If it does not, install from main:
  `cargo install --git https://github.com/antithesishq/snouty --branch main --locked`.
- Usage: `snouty runs exec <RUN_ID> <INPUT_HASH> <VTIME> [SCRIPT]`. Omit
  `SCRIPT` to read the script from stdin.
- Use a heredoc for anything multi-line. It avoids quoting problems, which get
  bad with gdb `-ex` arguments.
- `--timeout` defaults to 30 seconds. Raise it for slow scripts.

## Get a live session first

- `exec` needs a live session. A run holds one while it runs, and for a short
  time after it ends. Minutes after completion works. Hours later does not.
- For an older run, make a session first:

  ```bash
  snouty debug --run-id <run> --input-hash <hash> --vtime <vtime> \
    --description "why you are here"
  ```

  This returns a **new** run ID. Wait until it is ready, then `exec` against
  that new run ID.

## Where the script lands

- You land on the **host**, not in a container. PID 1 is systemd, and `podman`
  and `nsenter` are available. Every container is visible.
- A short process list does not mean you are confined to one container. Your
  own `head` or `tail` usually causes it, because long fuzzpipe and bash
  command lines eat the visible lines. Filter on purpose instead.
- Read any container filesystem at `/proc/<pid>/root/...`. Shared volumes are
  readable from any container's root, so on-disk forensics work whichever
  process you pick.
- Map a PID to a container with `/proc/<pid>/environ` (`HOSTNAME=...`), and
  cross-check against `podman ps`.

## gdb

- The host has gdb. The system-under-test image often does not.
- Point gdb at the container root, or every frame prints as `?? ()`:

  ```
  set sysroot /proc/<pid>/root
  file /proc/<pid>/root/path/to/binary
  attach <pid>
  ```

- gdb warns that the target and the debugger are in different PID namespaces
  and calls itself unreliable. Expect that warning.

## Virtual time is the main trap

- Virtual time **advances while your script runs**. One gdb attach costs
  roughly 0.3 to 0.4 vtime units.
- So a post-hoc attach cannot inspect a transient event: by the time gdb has
  the process, the failing frame is gone.
- Instead, exec at an **earlier** vtime on the same input hash. Set the
  breakpoints before the event, then run forward into it.
- Perturbation is real. In one case, arming breakpoints on six processes
  changed the scheduling enough that the race never fired. If the bug
  disappears under instrumentation, that is itself evidence of a
  timing-sensitive race.

## Zero-perturbation alternative

For "what happened just before X", replay the recorded events instead of
attaching a debugger:

```bash
snouty runs logs --json <RUN_ID> <HASH> <VTIME> --begin-vtime <X>
```

This perturbs nothing, and it answers most ordering questions faster than a
debugger does. Use `--json`, because the default view is summarized.
