# Feature Analysis

## Goal

Understand a specific feature well enough to identify its testable properties
and build a workload that exercises them. This is not a system survey — it is
focused exploration scoped to the code paths, state, concurrency, and failure
modes relevant to a specific feature.

The output is a set of feature properties: concrete, testable claims about
what the feature should do, what invariants it should maintain, and what
behaviors should be reachable.

## Step 1: Orient to the System

Before you can analyze a feature, you need enough understanding of the system
to navigate it. If full research artifacts exist in `antithesis/scratchbook/`
(from the `antithesis-research` skill), read `sut-analysis.md` and use it as
your orientation — skip this step.

Otherwise, build a lightweight orientation scoped to the feature's
neighborhood:

1. **Architecture.** What are the major components? How do they communicate?
   What are the entrypoints (`main()`, HTTP/gRPC handlers, CLI)? You need
   enough to know which component the feature lives in and what talks to it.

2. **Data flow.** Trace one representative request path from ingress through
   business logic to persistence. Note where state changes happen, where
   network calls cross service boundaries, and what consistency guarantees
   exist (or are claimed).

3. **Deployment topology.** How many processes, what roles, how are they
   connected? This determines what your docker-compose needs to look like and
   what fault scenarios are possible.

4. **Concurrency model.** Threading, async patterns, event loops, locking
   strategy. You need to know how concurrent operations interact before you
   can assess whether the feature has timing-sensitive behavior.

This is not a full SUT analysis. It is the minimum context to navigate the
codebase for this specific feature. Spend enough time to orient, then move on.
Record what you learn in the analysis file — it serves as context for the
rest of the work.

## Step 2: Understand the Feature

### Entry points

Feature-workload starts from one of two situations:

**The feature is done.** Source code is available. Read the code, trace data
flow through the feature, identify its state, concurrency characteristics, and
failure modes. Understand the feature's API surface — what operations does it
expose, what inputs does it accept, what outputs does it produce, what side
effects does it have?

Focus on:

- Entry points into the feature — handlers, public methods, message consumers
- Internal state the feature manages or modifies
- Dependencies the feature relies on — databases, caches, external services,
  other internal components
- Error paths and how the feature handles failures from its dependencies
- Concurrency — does the feature touch shared state? Can multiple callers
  exercise it simultaneously? Are there locks, queues, or coordination
  mechanisms?
- Lifecycle — does the feature have setup, teardown, migration, or upgrade
  paths?

**The feature is in development.** Some code may exist, or there may only be
a spec, design doc, or verbal description. Combine whatever code exists with
the spec and conversation to build understanding. Identify what is built vs.
what is planned.

For the built parts, analyze them as above. For the planned parts:

- What will the feature do? What operations, what data, what side effects?
- What are the intended invariants? What should never happen?
- What behaviors should be reachable? What states should the system visit?
- What are the testability implications of the planned design? Are there
  aspects that will be hard to observe or verify from outside?
- What dependencies will the feature have? How will it interact with the
  rest of the system?

Properties for unbuilt parts become TDD-style stubs in the workload —
assertions that will fail until the code catches up. Surfacing these
properties early can influence the feature's design toward testability.

## Step 3: Codebase Exploration

Explore the codebase through lenses relevant to the feature. Not all lenses
apply to every feature — use the ones the feature's characteristics point to.

### Feature boundaries

Where the feature interacts with the rest of the system. This lens is
specific to feature-workload — it maps the surface area the workload needs
to exercise and the contracts it needs to verify.

- API contracts — what does the feature promise to its callers? Input
  validation, output format, error semantics, idempotency guarantees.
- Data flow in and out — what data enters the feature, where does it go,
  what transformations happen, what state is written or read.
- Shared state — does the feature read or write state that other features
  also use? What coordination exists?
- Event interfaces — does the feature emit or consume events, messages, or
  notifications? What ordering or delivery guarantees exist?
- Configuration — what config knobs affect the feature's behavior? What are
  their defaults and limits?

### Concurrency and timing

Look for conditions where the feature's behavior depends on timing or
interleaving:

- Thread pools, event loops, async patterns on the feature's paths
- Locks and their ordering — especially across the code paths involved
- Shared mutable state touched by the feature's operations
- Lock-free data structures with subtle ordering requirements
- Concurrent access to collections or maps
- Operations that assume sequential execution but can interleave

Focus on "what if two callers exercise this feature at exactly the same
moment":

- Two writes to the same resource arriving concurrently
- A read arriving while a write is in progress
- A config change happening mid-operation
- A health check passing right before a component the feature depends on
  fails
- The feature being exercised during startup or shutdown

### State management

Look for:

- What state the feature manages — databases, caches, queues, in-memory
  structures
- How state moves between components — replication, propagation, caching
- What happens to in-flight state during failures
- Cache invalidation strategies and their edge cases
- Persistence boundaries — where does durable meet volatile
- State transitions — valid transitions, guarded transitions, transitions
  that should be impossible

### Failure and error handling

Look for:

- Error handling on the feature's code paths — missing checks, swallowed
  errors, catch-all handlers
- Retry logic — with or without backoff, with or without idempotency
- Timeout handling and hardcoded timeout values
- Partial failure paths — the messy states between "fully up" and "fully
  down"
- Recovery logic — what happens after a crash, restart, or reconnection
- Degraded operation — does the feature have fallback behavior? Is it
  correct?
- Health check implementations — do they accurately reflect the feature's
  ability to serve

### Unproven assumptions

Implicit axioms the feature is built on that are never validated. These are
often the most productive targets for testing:

- Error paths that don't exist ("this shouldn't happen")
- Dependencies with no failure handling
- Assumptions about clock synchronization
- Assumptions about message ordering
- Code that assumes a service is always reachable
- Catch blocks that log and swallow without recovery
- Assumptions about the order in which components start up

### Bug history

Check the feature's area for past bugs:

- Related closed issues — the fix may not cover all edge cases
- Recurring patterns in the same area — systemic issues
- Recently changed code in the feature's paths — regressions
- Known limitations or TODOs in the code

A filed issue is a reported bug, not a confirmed one. Confirm the defect is
real from primary evidence before building properties around it.

## Step 4: Discover Feature Properties

Turn what you learned into concrete, testable properties. Each property is a
specific claim about the feature's behavior — an invariant, a reachable
behavior, or a failure mode.

Work through these focuses. Not all apply to every feature — use the ones
relevant to what you found in the exploration above.

### Data integrity

- Does the feature guarantee that data written is data read back?
- Are there consistency windows where stale reads are possible? If so, what
  are the bounds?
- Does the feature maintain referential integrity or ordering guarantees?
- Can data be silently corrupted, truncated, or lost?

Properties here are typically `Always` or `AlwaysOrUnreachable` — invariants
that must hold on every evaluation.

### Concurrency

- What happens when multiple callers exercise the feature simultaneously?
- Are there race conditions in the feature's state management?
- Do concurrent operations produce results consistent with some serial
  ordering?
- Are there deadlock or livelock possibilities?

Properties here may be `Always` (no data corruption under concurrent access)
or `Sometimes` (concurrent operations can actually interleave — the workload
reaches the concurrent state).

### Failure recovery

- Does the feature recover correctly after crashes, restarts, or network
  failures?
- Is in-flight state preserved or correctly discarded?
- Does the feature converge to a correct state after transient failures?
- Are there failure modes that leave the feature in a permanently broken
  state?

Properties here are often `Always` (no data loss after acknowledged write
survives crash) with `Sometimes` reach claims proving the workload actually
exercises crash-recovery paths.

### Resource boundaries

- Does the feature respect configured limits (queue sizes, connection pools,
  batch sizes)?
- What happens at capacity? Backpressure, rejection, degradation?
- Are there off-by-one errors at boundary values?
- Does the feature handle resource exhaustion gracefully?

Properties here use `Always` for boundary respect and `Sometimes` for
reaching capacity states.

### Idempotency and replay

- Are operations that claim to be idempotent actually idempotent?
- What happens if the same request is sent twice?
- Does retry behavior produce correct results?
- Are there at-least-once or exactly-once guarantees, and do they hold?

Properties here are typically `Always` — the idempotency guarantee must hold
on every evaluation.

### Protocol contracts

- Does the feature implement a protocol correctly?
- Are there message ordering requirements? Are they maintained?
- Does the feature handle malformed input according to the protocol spec?
- Are version negotiation or capability negotiation paths correct?

Properties here are `Always` for protocol compliance.

### Choosing the assertion type

For each property, choose the Antithesis assertion type that matches its
semantics:

- **`Always`**: An invariant that must hold every time the check runs. Most
  feature properties are this type.
- **`AlwaysOrUnreachable`**: An invariant on an optional or rare path — if
  the path executes, the invariant must hold, but "never executed" is
  acceptable.
- **`Sometimes(cond)`**: A reach claim — a state or condition that should
  become true at least once. Use for proving the workload exercises the
  feature's behaviors.
- **`Reachable`**: A code path that should be reachable. Use for specific
  outcomes or branch results.
- **`Unreachable`**: A code path that should never be reached. Use for
  forbidden paths.

Record why you chose each assertion type — the rationale matters for review
and iteration.

## Attack Surfaces

Common patterns where features tend to have problems — check whether any
apply:

- **State transitions under concurrent faults**: What happens if a dependency
  fails mid-operation? Two callers modifying the same state simultaneously?
- **Polling/caching with stale data**: Anything that observes state
  asynchronously can act on outdated information.
- **Race conditions between control and data paths**: Configuration changes
  or topology updates arriving while the feature is actively serving.
- **Recovery from partial failures**: Some dependencies down, not all.
  Degraded state — does the feature behave correctly?
- **Component interactions making things worse**: Retries overloading a
  struggling dependency, cascading timeouts, thundering herd on recovery.
- **Runtime configuration changes under load**: Config change while the
  feature is actively serving traffic.
- **Health reporting accuracy**: Feature says "healthy" but can't actually
  serve.

## Partial Failures

Not just "dependency is up or down" but the messy states in between:

- Process down but sidecar is up
- Network partitioned to some peers but not others
- Disk slow but not dead
- CPU starved but not OOM-killed
- Connection pool exhausted but process is "healthy"

These partial failure modes often hide the most interesting bugs because
features are designed for clean failure, not degraded operation.

## Output

Write findings to `antithesis/feature-workloads/<feature-slug>/analysis.md`:

- Feature description — what the feature does, its API surface, its
  dependencies
- Development status — done or in development, what's built vs. planned
- System orientation notes — enough architecture and data flow context for
  someone reading the file to navigate the codebase
- Relevant code paths — files, functions, line numbers
- Discovered properties — each with a name, description, assertion type, and
  rationale for the type choice. For in-development features, mark which
  properties are for built vs. planned code
- Fault assessment notes — which fault types matter for this feature and why
  (see `references/faults.md`)
- Open questions — what you couldn't resolve from the code or spec alone
- What was examined and what was ruled out
