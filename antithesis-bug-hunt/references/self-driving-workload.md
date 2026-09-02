# Self-Driving Workload

## Goal

Build a workload that drives the SUT toward the bug's trigger conditions,
checks for the bug, and runs identically locally and in Antithesis. The
workload does not use Test Composer — it is a single program that manages
its own lifecycle.

## Why Not Test Composer

Test Composer orchestrates multiple commands with different scheduling
semantics (parallel drivers, serial drivers, eventually checks). That
orchestration layer only runs inside Antithesis. A self-driving workload runs
the same code locally and in Antithesis — the only difference is whether SDK
assertions emit to a file or no-op. This means:

- You can iterate locally with fast feedback loops before paying for
  Antithesis runs
- The workload behavior is identical in both environments — no "works locally
  but not in Antithesis" bugs in the harness itself
- You control the exact scenario: operation sequence, timing, validation
  points

The tradeoff is that you manage your own lifecycle. Test Composer handles
parallelism, serialization, phasing, and quiet periods automatically. A
self-driving workload implements whatever subset of that it needs.

## Structure

### Single entrypoint

The workload is one program with one entrypoint. It starts, drives operations
against the SUT, checks results, and eventually exits (or runs continuously
for local use). The entrypoint handles both local and Antithesis modes.

### Dual-mode assertions

When `ANTITHESIS_OUTPUT_DIR` is set, the workload is running inside
Antithesis. Use SDK assertions: `Always`, `Sometimes`, `Reachable`,
`AlwaysOrUnreachable`, `Unreachable`. These emit structured data that
Antithesis uses for property checking, branch guidance, and replay.

When `ANTITHESIS_OUTPUT_DIR` is not set, the workload is running locally. Use
equivalent local checks: log violations, exit non-zero on critical failures,
print diagnostic output. The simplest pattern:

```python
import os
ANTITHESIS = bool(os.environ.get("ANTITHESIS_OUTPUT_DIR"))

if ANTITHESIS:
    from antithesis.assertions import always
    always(condition, "property name", details)
else:
    if not condition:
        print(f"VIOLATION: property name — {details}")
        sys.exit(1)
```

Wrap this in a helper so assertion callsites are clean. The helper still uses
inline constant string literals for the property name — the name is passed
through the helper, but it originates as a literal at the callsite. See
`references/assertions.md` for naming requirements.

### Main loop

The workload typically runs in a loop:

1. Perform operations against the SUT (writes, reads, transactions, API calls)
2. Check invariants after each operation or batch of operations
3. Track what was attempted and what was acknowledged
4. Repeat

For local use, the loop can run continuously (`while True`) or for a bounded
number of operations / duration. For Antithesis, continuous is fine — Antithesis
controls the timeline's lifetime.

A common pattern is two modes controlled by an environment variable:

- **Continual**: Run forever, checking invariants periodically. Good for local
  development and for Antithesis runs.
- **Epochal**: Run a fixed number of operations, then do a final consistency
  check and exit. Good for CI smoke tests.

### Operation design

Design operations to drive toward the bug's trigger conditions. The trigger
hypothesis (from `references/targeted-research.md`) tells you what
preconditions need to hold. Each operation should bring the system closer to
those preconditions.

**Try everything sometimes.** Exercise the full API surface relevant to the
bug, including operations that aren't directly part of the trigger sequence.
Adjacent operations can create the state or timing conditions the bug needs.
Configuration, administration, and setup functions tend to hide bugs and are
easy to overlook.

**Don't avoid expected failures.** If the trigger hypothesis involves crash
recovery or degraded operation, the workload should drive operations that
encounter those conditions. Recovery processes hide a disproportionate number
of bugs.

**Exercise concurrency.** If the bug involves concurrent operations, the
workload should drive multiple concurrent clients or threads. The degree of
concurrency is a tunable parameter — too much swamps the system, too little
misses the interleaving.

### Continuous validation

Validate as you go, not just at the end. Check invariants after each operation
or small batch, not after a thousand operations. Three reasons:

1. **Bugs cancel each other out.** The system enters a broken state, then by
   luck recovers before a final check would notice.
2. **Debugging is harder with distance.** A long history between cause and
   detection makes investigation harder.
3. **Earlier detection is cheaper.** Finding the bug in the first minute beats
   finding it after an hour of irrelevant history.

### Randomness and swarm testing

All randomness in the workload must go through the Antithesis SDK's random
module for deterministic replay. This applies to operation selection, value
generation, timing decisions, and any other random choices. When running
locally (no SDK), use the standard library's random module.

**Vary the shape of randomness across runs.** Don't hardcode probabilities
and action weights as constants. At the start of each run (or each Antithesis
timeline), draw those parameters from a wide range — including the extremes
— so some runs are heavily biased toward one class of operation and others
are biased the other way.

This is swarm testing: a single run that's deliberately skewed goes deep into
one corner of the state space; across many runs, the union of skews covers
the surface and finds bugs that uniform mixing never reaches.

A simple implementation: for each tunable probability, replace `P = 0.3` with
`P = random_choice([0.02, 0.3, 0.95])` from the SDK's random module. Three
buckets is illustrative — what matters is covering the extremes plus a middle
case. For action weights, occasionally zero out one or more entries to explore
what happens when an operation class is absent.

Also include **action omission**: drop each class of action independently with
some small probability at the start of the run. Re-roll if the result is
empty. The limiting case of skew — an entire operation class absent — can
surface bugs that always-present action mixes never find.

### Value selection

Don't draw values from arbitrary ranges. Use value menus: boundary values
for the input type plus configured-limit families from the code paths the
bug touches. See `references/interesting-values.md` for how to build the
menu.

### Quiet periods for liveness checks

When running in Antithesis, the workload can request a quiet period — all
fault injection stops temporarily, giving the system time to recover. This
is useful when the trigger hypothesis involves recovery behavior.

The mechanism: Antithesis injects an `ANTITHESIS_STOP_FAULTS` binary into
every container and sets the corresponding environment variable.

```bash
[ "${ANTITHESIS_STOP_FAULTS}" ] && "${ANTITHESIS_STOP_FAULTS}" <DURATION_SECONDS>
```

The guard clause lets the script run harmlessly outside Antithesis. After the
quiet period, faults resume automatically.

Use this for mid-run liveness checks: drive operations under faults, request
a quiet period, wait for the system to stabilize, check whether it recovered
correctly, then resume. This is especially valuable when the bug involves
recovery — the quiet period lets you verify whether recovery actually works.

## Fault Tolerance

The workload runs under fault injection in Antithesis. Transient errors are
expected, not exceptional. The workload's job is to keep making progress, not
bail on the first failure.

### Design for goals, not procedures

Write workload operations as loops that drive toward an objective, not fixed
sequences of attempts. A workload that tracks "I tried 100 times" has nothing
useful to assert against in a faulty environment; one that tracks progress
against a goal can assert on that progress.

### Construct bounds, don't claim exact knowledge

Under fault injection the workload doesn't have perfect visibility — requests
fail in flight, acknowledgments get dropped, clocks drift. Record enough of
what happened to construct bounds the SUT must satisfy.

The most common way: track attempts and acknowledgments separately. If the
workload sends 100 increment requests and 80 are acknowledged, the counter
must have changed by some number between 80 and 100 — unacknowledged requests
may have succeeded anyway. A later read showing 75 or 120 is a bug. A
workload that records only "I called increment 100 times" has no bound to
assert against.

See `references/assertions.md`, "Assert Bounds, Not Exact Values" for how to
express bounds as assertions.

### Retries are inputs to the system

Retries shape what bugs you find. Retrying after a lost acknowledgment can
surface real idempotency bugs (good — that's a production scenario). Retrying
past the SUT's idempotency contract creates faulty client behavior that
produces false-positive assertion failures (bad). Decide what the SUT promises
about idempotency before designing retry behavior.

### Faults to handle

See `references/faults.md` for the full catalog. At minimum, handle:

- Process kill/restart (connections drop, state may be lost)
- Network partition (requests fail, some unidirectionally)
- Clock skew (timestamps may go backward)
- I/O delays/stalls (operations take unexpectedly long)

### Common fault tolerance patterns

- **Retry with backoff.** Exponential or jittered backoff for transient
  failures. Don't retry indefinitely for non-transient errors.
- **Reconnect on disconnect.** Connections will drop. The workload should
  reconnect and resume, not crash.
- **Timeout operations.** Don't wait forever. Set timeouts and treat them as
  transient failures.
- **Track state across retries.** If a retried operation might have succeeded
  on the first attempt (lost acknowledgment), track both possibilities in your
  bounds.

## Production Isolation

- Code in the `antithesis/` directory should never make it to production.
- Edits outside that directory should be surgical and walled off.
- Antithesis-only code does not need heavy configuration — prefer simple,
  explicit logic.
- SDK assertions no-op outside Antithesis, so SUT-side assertions are safe in
  production — they become low-overhead fallbacks.

## Output

- Workload program under `antithesis/` (or wherever the project keeps
  test/workload code)
- Docker-compose service definition for the workload container
- Helper utilities as needed (client wrappers, mock services)
