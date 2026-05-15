# Component Implementation

## Goal

Implement only the workload-side components the existing code cannot already provide.

## Approach

This is the most open-ended part of the skill. Start with the simplest component that can exercise the target behavior.

## Production Isolation Principles

- Code in the antithesis directory should never make it to production.
- Edits outside that directory should be surgical and walled off or compiled away.
- Antithesis-only code does not need heavy configuration. Prefer simple, explicit logic.

## Common Patterns

- **Client wrappers:** Write thin wrappers around the project's client APIs or protocols when the existing clients do not fit Antithesis workloads cleanly.
- **Mock services:** Replace unimportant dependencies when they add state space without helping test the behavior you care about.

## Fault Tolerance in Workload Code

Workloads run under fault injection. Transient errors are expected, not exceptional — the workload's job is to keep making progress toward its goal, not to bail on the first failure.

### Design for goals, not procedures

Write workload operations as loops that drive toward an objective, not fixed sequences of attempts. A workload that tracks "I tried 100 times" has nothing useful to assert against in a faulty environment; one that tracks progress against a goal can operate while the environment drops requests, partitions the network, or restarts nodes.

### Construct bounds, don't claim exact knowledge

Under fault injection a workload doesn't have perfect visibility — requests fail in flight, acknowledgments get dropped, clocks drift. The workload's job is to record enough of what happened to construct bounds the SUT must satisfy. Anything outside those bounds has probability zero of being correct, and that's how bugs surface.

The most common way to construct a bound is to track attempts and acknowledgments separately. If a workload sends 100 increment requests to a counter and 80 are acknowledged, the counter must have changed by some number between 80 and 100 — unacknowledged requests may have succeeded anyway. A later read showing 75 or 120 is a bug, in the SUT or in the workload itself. A workload that records only "publish() called 100 times" has no bound to assert against.

See `assertions.md`, "Assert Bounds, Not Exact Values" for how to express these bounds as assertions.

### Retries are inputs to the system

Retries are inputs the workload feeds into the SUT, not free additions — they shape what bugs you find. Retrying after an acknowledgment is lost can surface real idempotency bugs (good — that's a production scenario). Retrying past the SUT's idempotency contract creates faulty client behavior that produces false-positive assertion failures (bad). Decide what the SUT promises about idempotency before designing retry behavior.

### Faults to handle

Read the Fault injection documentation to learn what your code needs to tolerate:

- Process kill/restart
- Network partition (full and partial)
- Clock skew
- I/O delays/stalls
