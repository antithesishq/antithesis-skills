# Targeted Research

## Goal

Understand how a specific bug could happen in the codebase — or whether a
supposedly fixed bug is actually fixed. This is not a system survey; it is
focused exploration scoped to the code paths, state, concurrency, and failure
modes relevant to a specific defect.

The output is a trigger hypothesis: a specific, testable claim about what
conditions cause the bug (or what conditions the fix might not cover).

## Step 1: Orient to the System

Before you can trace a bug to its cause, you need enough understanding of the
system to navigate it. If full research artifacts exist in
`antithesis/scratchbook/` (from the `antithesis-research` skill), read
`sut-analysis.md` and use it as your orientation — skip this step.

Otherwise, build a lightweight orientation scoped to the bug's neighborhood:

1. **Architecture.** What are the major components? How do they communicate?
   What are the entrypoints (`main()`, HTTP/gRPC handlers, CLI)? You need
   enough to know which component the bug lives in and what talks to it.

2. **Data flow.** Trace one representative request path from ingress through
   business logic to persistence. Note where state changes happen, where
   network calls cross service boundaries, and what consistency guarantees
   exist (or are claimed).

3. **Deployment topology.** How many processes, what roles, how are they
   connected? This determines what your docker-compose needs to look like and
   what fault scenarios are possible.

4. **Concurrency model.** Threading, async patterns, event loops, locking
   strategy. You need to know how concurrent operations interact before you
   can assess whether a bug is timing-sensitive.

This is not a full SUT analysis. It is the minimum context to navigate the
codebase for this specific bug. Spend enough time to orient, then move on.
Record what you learn in the analysis file — it serves as context for the
rest of the hunt.

## Step 2: Understand the Bug

### Entry points

Bug-hunt starts from one of these:

**An open bug report.** Someone reports a suspected defect. Parse the report
and validate it (see below).

**A closed bug you want to verify.** Someone fixed a bug and you want to
prove the fix holds — or prove it doesn't. Read the original report, the fix
(the PR, the commit, the code change), and the discussion. Understand what
the fix covers and where its edges are. The trigger hypothesis here is: "what
conditions might the fix not handle?"

**A description of a suspected weakness.** Not a specific bug report but a
concern: "I think our replication has a window where writes can be lost during
failover." Treat this like a hypothesis to test — skip report parsing, go
straight to codebase exploration.

### Parsing a bug report

A bug report is a claim, not a fact. The reporter describes symptoms and
often guesses at a cause, but the reporter is frequently wrong about the
cause. Your job is to find the mechanism in the code, not to trust the
description.

Extract the concrete details:

- **Symptoms**: What went wrong? Error messages, incorrect state, crash,
  hang, data loss, inconsistency.
- **Conditions**: What was happening when it went wrong? Load level,
  concurrent operations, recent changes, deployment topology.
- **Reproduction steps**: If provided. These are hints, not a script — the
  reporter may have cargo-culted steps that happen to precede the bug without
  causing it.
- **Expected vs actual**: What should have happened and what did.

### Validating before building on it

Name the competing explanation before you look. For a bug report it is almost
always "this is the reporter's environment or config, not the system." Then
read the evidence that tells the two apart, and record the specific detail
that settles it. "The issue says X" is not validation — it cites the claim.
Primary evidence is: the attached logs, the reproduction, the mechanism in
the code, the issue's resolution. If you cannot quote discriminating detail
from primary evidence, the claim does not enter as a confirmed defect.

Read past the headline. The title and first paragraph are a headline; the
logs, repro, comments, and resolution carry the evidence — and they are the
parts a hurried read skips. Weigh the source's standing: an open,
uncommented, single-reporter issue is far weaker than a maintainer-confirmed
one with logs.

If you cannot validate the defect, record it as an open question — not as a
confirmed bug to reproduce.

### Examining a fix

For closed bugs, the fix is the primary artifact. Read:

- **The code change.** What was changed? What condition does the fix guard
  against?
- **The scope of the fix.** Does it handle the general case or just the
  reported instance? Are there related code paths that have the same
  pattern but weren't fixed?
- **The discussion.** Did reviewers raise edge cases? Were any deferred or
  dismissed?
- **The test.** If the fix came with a test, what does the test cover? What
  doesn't it cover? Can you construct conditions that the test doesn't
  exercise but the bug's mechanism still applies to?

The trigger hypothesis for a closed bug is: what conditions might bypass or
exceed the fix?

## Step 3: Codebase Exploration

Explore the codebase through lenses relevant to the bug. Not all lenses
apply to every bug — use the ones the symptoms point to.

### Trace the symptom path

Follow the reported symptoms to their origin in the code. If the symptom is
"incorrect value returned," find the code that computes and returns that value.
If the symptom is "crash," find the crash site and its call chain. If the
symptom is "inconsistent state," find where that state is written and read.

- Read entrypoints: `main()`, HTTP/gRPC handlers, CLI argument parsing
- Trace request paths from ingress through business logic to persistence
- Identify service boundaries and network calls on the path
- Note where state changes happen and what consistency guarantees exist

### Concurrency and timing

Many bugs that reach Antithesis are timing-sensitive. Look for:

- Thread pools, event loops, async patterns on the affected paths
- Locks and their ordering — especially across the code paths involved
- Shared mutable state touched by the affected operations
- Lock-free data structures with subtle ordering requirements
- Concurrent access to collections or maps
- Operations that assume sequential execution but can interleave

Antithesis's superpower is exploring execution interleavings. Focus on "what
if X happens at exactly the wrong moment during Y":

- A write arriving during a leader election
- A config reload happening mid-request
- A health check passing right before a process crashes
- Two clients operating on the same data in overlapping transactions

### State management

Look for:

- What state is stored where (databases, caches, queues, in-memory)
- How state moves between components — replication, propagation, caching
- What happens to in-flight state during failures
- Cache invalidation strategies and their edge cases
- Persistence boundaries — where does durable meet volatile

### Failure and error handling

Look for:

- Error handling on the affected code paths — missing checks, swallowed
  errors, catch-all handlers
- Retry logic — with or without backoff, with or without idempotency
- Timeout handling and hardcoded timeout values
- Partial failure paths — the messy states between "fully up" and "fully
  down"
- Recovery logic — what happens after a crash, restart, or reconnection
- Health check implementations — do they accurately reflect ability to serve

### Unproven assumptions

Implicit axioms the code is built on that are never validated. These are often
the most productive targets:

- Error paths that don't exist ("this shouldn't happen")
- Dependencies with no failure handling
- Assumptions about clock synchronization
- Assumptions about message ordering
- Code that assumes a service is always reachable
- Catch blocks that log and swallow without recovery

### Bug history

If the bug report references a specific component, check that component's bug
history:

- Related closed issues — the fix may not cover all edge cases
- Recurring patterns in the same area — systemic issues
- Recently changed code in the affected paths — regressions

A filed issue is a reported bug, not a confirmed one. The same validation
applies: confirm the defect is real from primary evidence before building on it.

## Attack Surfaces

Common patterns where bugs hide — check whether any apply to the reported bug:

- **State transitions under concurrent faults**: What happens during failover
  with in-flight writes? Two nodes both think they're the leader?
- **Polling/caching with stale data**: Topology watchers, health checks, DNS
  caches — anything that observes state asynchronously can act on outdated
  information.
- **Race conditions between control and data plane**: The control plane says
  "node B is the new leader" but traffic still goes to node A.
- **Recovery from partial failures**: Some nodes down, not all. Degraded state
  — does the system behave correctly?
- **Component interactions making things worse**: Monitoring overloading a sick
  node, recovery actions conflicting, retry storms.
- **Runtime configuration changes under load**: Config change while actively
  serving traffic.
- **Health reporting accuracy**: System says "healthy" but can't serve.

## Partial Failures

Not just "node is up or down" but the messy states in between:

- Process down but sidecar is up
- Network partitioned to some peers but not others
- Disk slow but not dead
- CPU starved but not OOM-killed
- Connection pool exhausted but process is "healthy"

These partial failure modes often hide the most interesting bugs because systems
are designed for clean failure, not degraded operation.

## Forming the Trigger Hypothesis

After exploration, state a specific, testable claim:

1. **What sequence of operations** could trigger the bug?
2. **What preconditions** must hold (state, configuration, timing)?
3. **What concurrency** is needed (how many clients, what interleaving)?
4. **What faults** are needed (if any)? Network partitions, process crashes,
   clock skew, specific restart timing?
5. **What values** matter? Boundary values, specific sizes, specific counts?

The hypothesis must be testable — it should describe conditions the workload
can create and an outcome the workload can detect.

### Classification

Based on the hypothesis, classify:

- **Locally reproducible**: The trigger requires only concurrent operations,
  specific values, or specific sequences — no fault injection, no scheduling
  control beyond what concurrent load provides.
- **Needs Antithesis**: The trigger requires fault injection, scheduling
  nondeterminism, crash-recovery sequences, network partitions, or similar
  conditions local testing cannot reliably provide.

Favor local. "It might be a race condition" is not enough to skip local —
many races are reproducible under concurrent load alone. Go directly to
Antithesis only when the hypothesis specifically requires its capabilities.

## Output

Write findings to `antithesis/bug-hunt/<bug-slug>/analysis.md`:

- Bug description (from the report, validated where possible)
- Relevant code paths (files, functions, line numbers)
- Trigger hypothesis with supporting evidence from the code
- Classification (locally reproducible vs needs Antithesis)
- Open questions (what you couldn't resolve from the code alone)
- What was examined and what was ruled out
