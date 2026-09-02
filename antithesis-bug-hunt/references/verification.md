# Verification

## Goal

When a property fails, determine whether the failure represents the actual
bug you're hunting, a different bug, or a problem in the harness. A property
failure is a candidate, not a conclusion.

## Reading the Counterexample

Whether from local output or Antithesis triage:

1. **Identify the sequence of events** leading to the failure. What operations
   happened? What state was the system in? What faults were active?
2. **Identify the assertion that failed.** Which specific assertion? What were
   the values at the moment of failure?
3. **Compare to the trigger hypothesis.** Does the observed sequence match
   what you predicted? If it doesn't, the mechanism may be different from
   what you expected.

For Antithesis runs, use `antithesis-triage` to get the failure details. If
the triage output isn't enough to understand the mechanism, use
`antithesis-debug` to inspect container state at the failure moment — the
Multiverse Debugger lets you time-travel through the sequence and inspect
state at any point.

## Classifying the Finding

### Real bug in SUT

The assertion correctly detected the bug described in the report. Evidence:

- The sequence of events demonstrates the bug's mechanism — you can explain
  step by step how the system arrived at the incorrect state
- The mechanism matches (or explains) the symptoms in the bug report
- The failure is reproducible (locally, in Antithesis, or both)
- No harness, assertion, or workload bug explains the observation

This is the target outcome. Proceed to documenting the reproduction.

### Different bug

The assertion fired, but the mechanism is different from the reported bug.
Evidence:

- The sequence of events shows a real SUT defect
- The defect doesn't match the reported symptoms or mechanism
- The system is genuinely wrong, just in a different way

This is still valuable — record it. But the hunt continues for the original
bug. A different bug may also explain the original report if the reporter
misidentified the symptoms.

### Assertion bug

The assertion itself is wrong or too strict. Evidence:

- The SUT behavior is actually correct given the inputs and conditions
- The assertion doesn't account for a valid edge case, a transient state,
  or a legitimate execution order
- The assertion fails on correct behavior, not on a bug

Common assertion bugs:

- **Too strict on timing.** The assertion checks a condition that's transiently
  false during normal operation (e.g., checking consistency during an in-flight
  update).
- **Wrong bound.** The assertion uses exact equality instead of bounded
  assertions. Under fault injection, unacknowledged operations may have
  succeeded.
- **Missing precondition.** The assertion checks a condition that only makes
  sense after specific setup, but the workload sometimes evaluates it before
  setup completes.
- **Stale state.** The assertion reads state that hasn't propagated yet and
  treats the stale value as incorrect.

Fix the assertion and continue the hunt.

### Workload bug

The workload created an invalid scenario. Evidence:

- The workload sent malformed input, violated a protocol, or misused an API
- The SUT's response to the invalid input is correct (or at least not the
  bug you're hunting)
- The assertion failure is a consequence of the workload's mistake, not a
  SUT defect

Common workload bugs:

- **Violating idempotency contracts.** Retrying an operation the SUT doesn't
  promise is idempotent, then asserting on the unexpected result.
- **Race in the workload.** The workload's own concurrency creates an invalid
  state in its tracking data, causing a false assertion.
- **Wrong operation sequence.** The workload calls APIs in an order the SUT
  doesn't support and treats the error as a bug.
- **Incorrect bounds tracking.** The workload miscounts attempts or
  acknowledgments, producing wrong bounds that the SUT correctly violates.

Fix the workload and continue the hunt.

### Environment issue

Infrastructure or configuration problem. Evidence:

- The failure is caused by a misconfigured container, missing dependency,
  incorrect network setup, or resource exhaustion in the test environment
- The SUT never entered the state the assertion checks because the
  environment prevented it from running normally

Common environment issues:

- **Containers can't reach each other.** Network misconfiguration, DNS
  resolution failure, wrong IP addresses.
- **Container crash loops.** OOM, missing config files, broken entrypoints.
- **Missing SDK setup.** `ANTITHESIS_OUTPUT_DIR` not set, SDK not initialized,
  assertion catalog not linked.
- **Resource exhaustion.** Disk full, port conflicts, connection limits.

Fix the environment and continue the hunt.

## Verification Questions

For any finding, ask:

1. **Can I explain the mechanism step by step?** If not, dig deeper — use
   `antithesis-debug` for Antithesis runs, add logging for local runs.
2. **Is the SUT actually wrong?** The sequence shows what happened; that's
   not the same as wrong. The SUT may have correctly handled an unusual but
   valid scenario.
3. **Could the workload have caused this?** Check whether the workload's
   own behavior (retries, concurrent access, operation ordering) created the
   conditions rather than the SUT's logic.
4. **Does this match the reported bug?** The mechanism should connect to the
   reported symptoms. If it doesn't, it may be a different bug — still
   valuable, but the hunt continues.

## Documenting a Verified Reproduction

When a finding is confirmed as the real bug, record it in
`antithesis/bug-hunt/<bug-slug>/reproduction.md`:

- **Trigger sequence**: The step-by-step sequence of events that triggers the
  bug — what operations, what state, what timing or faults.
- **Detection**: Which assertion detected it and what the values were at
  failure.
- **Mechanism**: How the system arrives at the incorrect state — the root
  cause, not just the symptoms.
- **Counterexample details**: For Antithesis runs: run ID, moment, containers
  involved. For local runs: log output, timestamps.
- **Connection to the report**: How this mechanism explains the originally
  reported symptoms.
