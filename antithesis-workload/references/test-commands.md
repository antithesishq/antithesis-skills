# Test Commands

## Goal

Create test templates whose commands exercise the SUT in useful, diverse ways.

## Test Template Structure

A test template is a directory at `/opt/antithesis/test/v1/{name}/` containing test command files. A timeline runs commands from one test template. If you are unsure how to split coverage, start with one template.

A template must contain at least one of: `parallel_driver_`, `serial_driver_`, `singleton_driver_`, or `anytime_` commands. The other command types (`first_`, `eventually_`, `finally_`) only run relative to drivers or anytime commands, so a template with none of the four has nothing for Antithesis to schedule.

Files and subdirectories prefixed with `helper_` are ignored by Antithesis, so use that prefix for shared helpers that need to live inside the template. Any non-helper executable placed directly in a template should be a real test command with a valid prefix.

Any container with test templates must be kept running (e.g., via `sleep infinity` in the entrypoint). If the container exits, Antithesis cannot execute its commands.

Multiple containers can reference the same test template path. When containers `client-a` and `client-b` both have `/opt/antithesis/test/v1/main/`, Antithesis treats both sets as one template, with each command executing in its source container.

## Test Command Requirements

A test command is an executable file whose filename starts with a recognized prefix. It must:

- Be marked executable by the container's default user
- Be a compiled binary or have a shebang line (e.g., `#!/usr/bin/env python3`)
- Eventually exit
- Never emit `setup_complete` — test commands only run after Antithesis receives it, so emitting it from a test command deadlocks startup

Symlinks to existing scripts are supported.

## Test Command Prefixes and Their Behavior

### `first_`

- **Purpose:** One-time per-timeline initialization.
- **Scheduling:** Runs after `setup_complete` but before all other commands. If multiple `first_` commands exist, Antithesis selects exactly one.
- **Faults:** Not injected.
- **Concurrency:** No other commands run alongside.
- **Notes:** The `setup_complete` deadlock risk (see Test Command Requirements) is especially easy to trigger here, since `first_` commands handle initialization logic.

### `parallel_driver_`

- **Purpose:** Concurrent, repeated tasks — writes, reads, transactions, API calls.
- **Scheduling:** Runs after `first_` (if any) or immediately after `setup_complete`. Runs concurrently and repeatedly.
- **Faults:** Injected normally, including mid-execution.
- **Concurrency:** Multiple instances can run simultaneously. `anytime_` commands may also run alongside.

### `serial_driver_`

- **Purpose:** Operations that must not overlap with other drivers.
- **Scheduling:** Runs repeatedly, but only one at a time. Starts after `first_` (if any) or immediately after `setup_complete`.
- **Faults:** Injected normally.
- **Concurrency:** Only `anytime_` commands may run alongside. No other drivers run concurrently.

### `singleton_driver_`

- **Purpose:** Exclusive operations that run exactly once per timeline.
- **Scheduling:** Runs once, after `first_` (if any) or immediately after `setup_complete`.
- **Faults:** Injected normally.
- **Concurrency:** Only `anytime_` commands may run alongside.
- **Use cases:** Porting existing test suites, monolithic workloads, proof-of-concept testing.

### `anytime_`

- **Purpose:** Continuous invariant checks.
- **Scheduling:** Runs after `first_`, during any subsequent phase — including during driver execution and while `eventually_` or `finally_` commands start.
- **Faults:** Active during driver phases. When `eventually_` or `finally_` runs, faults stop, but already-running `anytime_` commands complete.
- **Concurrency:** May run alongside any command type except `first_`.
- **Examples:** "Read reflects previous write," availability monitoring.

### `eventually_`

- **Purpose:** Check system recovery and eventually-true invariants — eventual consistency, convergence, availability after faults.
- **Scheduling:** Runs only after at least one driver has started. Kills other running commands when it starts (except `anytime_`, which completes).
- **Faults:** All fault injection stops when this command starts.
- **Concurrency:** Running `anytime_` commands complete; no new commands start alongside.
- **Notes:** The timeline branch will not resume testing after this command runs, so destructive actions are safe. Should include retry loops or health checks since the system may need time to stabilize after faults stop.

### `finally_`

- **Purpose:** Check final system state after all work completes.
- **Scheduling:** Runs only after all started drivers complete naturally (not killed). Kills other running commands when it starts (except `anytime_`, which completes). Only runs on timelines where drivers finished on their own.
- **Faults:** All fault injection stops when this command starts.
- **Concurrency:** Running `anytime_` commands complete; no new commands start alongside.
- **Notes:** The timeline branch will not resume testing after this command runs, so destructive actions are safe. Should include retry loops or health checks since the system may need time to stabilize after faults stop.
- **Examples:** "Database contains exactly N rows," final consistency checks.

## `eventually_` vs. `finally_`

These two command types are similar but serve different purposes:

| Aspect | `eventually_` | `finally_` |
|--------|---------------|------------|
| Question answered | "Does the system recover?" | "Is the final state correct?" |
| When it runs | After driver(s) start | After all drivers complete naturally |
| How drivers end | Killed by Antithesis | Completed on their own |
| Faults | Stopped | Stopped |
| Destructive actions | Safe — branch won't resume | Safe — branch won't resume |

## Concurrency Summary

| Command | Faults active? | Can run alongside |
|---------|---------------|-------------------|
| `first_` | No | Nothing |
| `parallel_driver_` | Yes | `parallel_driver_`, `anytime_` |
| `serial_driver_` | Yes | `anytime_` |
| `singleton_driver_` | Yes | `anytime_` |
| `anytime_` | Yes (during drivers) | Any except `first_`; during `eventually_`/`finally_`, running instances complete but new ones are not started |
| `eventually_` | No | Running `anytime_` commands complete |
| `finally_` | No | Running `anytime_` commands complete |

## Guidance

- Antithesis already checks that commands exit 0, so a non-zero exit should mean something is genuinely wrong.
- Treat commands as levers for the fuzzer. Diverse commands produce richer system states.
- Reserve `setup_complete` for a container entrypoint or other long-lived startup process that runs before Antithesis starts executing timeline commands.
- Driver commands connect to the SUT under active fault injection — handle transient network faults gracefully (see `component-implementation.md` for details).
- All randomness in test commands must go through the Antithesis SDK's random module for deterministic replay (see `assertions.md` for details).
- Write commands in the project's language, not Bash, so they can reuse existing clients, helpers, and libraries.

## Output

One or more test templates containing test command executables written to `antithesis/test/`.
