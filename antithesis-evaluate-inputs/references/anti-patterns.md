# Input Generation Anti-Patterns

Anti-patterns that limit how much state space a workload explores. Each
describes a structural property of the workload code that prevents it from
reaching regions of behavior. Organized by category.

The core principle: randomize the *policy* per run, not just the *choices
under a fixed policy*. Each run should explore a different region of behavior
by biasing its configuration differently.

---

## Action Selection

### All actions always active with no per-run subsetting

Every run exercises the full action set with the same participation. No
mechanism to select a subset of actions for a given run.

When all actions always participate, every run explores roughly the same macro
behavior. Interesting states often live in regions where some actions
dominate — a run that only does deletes against non-existent keys, or a run
that only does writes so state accumulates unboundedly.

Per-run, randomly select 1 to N actions from the full set to be active. Some
runs get one action, some get all of them.

**The symmetric pair signal:** When the action set contains pairs that cancel
each other's effects (put/delete, create/destroy, add/remove), subsetting is
especially valuable. Running both together keeps state near the starting
point. Running them separately lets state drift to extremes.

### Feature suppression unawareness

The workload includes all features/actions in every run, assuming more
coverage per run means better overall coverage.

The core finding from the original swarm testing paper (Groce et al., ISSTA
2012): including a feature doesn't just add behavior — it can *suppress*
other behavior. Including `pop` in a stack test prevents the stack from
growing large enough to trigger overflow. Including `delete` prevents key
counts from climbing high enough to trigger compaction. There is no
universally optimal configuration.

Per-run random feature omission lets the remaining actions drive the system
into states that the omitted actions would have prevented.

### Fixed or uniform action distribution with no per-run bias

Actions are selected uniformly at random (e.g., 33/33/33 for three actions)
and that distribution is the same every run.

Uniform randomness at the choice level produces identical macro behavior
across runs. Every run ends up with roughly the same key count, the same mix
of operations, the same steady-state resource usage.

Each run should draw its own action weights — run A might be 80/15/5, run B
might be 10/60/30. The weights are the thing that varies across runs.

### Fixed action ordering / rigid sequence templates

The workload always executes actions in the same pattern — always
`create → use → delete`, always `put → put → get`. The ordering is imposed
by the test harness, not by the system's actual preconditions.

Bugs often require specific orderings to manifest: `delete → create` (delete
something that doesn't exist yet), `use → create` (use before setup),
`delete → delete` (double-free). A fixed template explores one path through
the ordering space.

Actions should be selected independently per step with no ordering
constraints beyond what the system's actual preconditions require.

### Over-tuned randomness (hand-optimized distributions)

The developer has tuned the distribution to bias toward what they think is
interesting — always calling `a(); a(); b()` because they believe repetition
matters.

If the hypothesis is right, this finds that specific bug slightly faster. If
it's wrong, the workload is stuck in a region that doesn't contain the bug.
A tuned distribution trades breadth for depth on a single hypothesis.

Per-run variation in the bias — diverse configurations across runs —
outperforms a single optimized distribution.

### No variation in run length

Every run executes the same number of operations. The run length is a
constant, not a parameter.

Short runs find shallow bugs efficiently. Long runs reach deep accumulated
state — memory leaks, counter wraps, GC pressure, log rotation. A fixed
length misses one end or the other.

Run length should be a per-run random parameter.

### Testing a subset of the API surface

The workload exercises 3 operations on a system that exposes 12. The untested
operations never participate.

Each operation may interact with system state in ways the tested subset
doesn't reveal. The workload's action set should cover the full API surface
(or a principled large subset), with per-run subsetting controlling which
ones are active in any given run.

### Production-tuned thresholds in test configuration

The workload uses production-scale timing for background operations:
compaction every hour, leader election timeout at 30 seconds, GC at 10GB.

In a test that runs for minutes, these thresholds mean the background logic
never fires. Scale thresholds to match test duration. Make thresholds a
per-run parameter so different runs trigger background logic at different
points.

### State-dependent filtering without exploration pressure

Actions have preconditions, and the workload strictly filters to "valid"
actions for the current state: can't delete if nothing exists, can't read if
not connected.

This prevents the workload from attempting actions the system *should handle
gracefully* but hasn't been tested against — deleting a non-existent key,
reading from a closed connection, committing an empty transaction.

Distinguish physical constraints of the harness (can't send if there's no
socket) from assumptions about what the system handles (can't delete if
nothing exists). Relax the latter.

---

## Data Generation

### Inputs drawn exclusively from a narrow valid subset

All generated inputs are well-formed, reference existing resources, and stay
within a small portion of the valid domain. No per-run variation in what
"valid" means.

Real systems encounter invalid inputs, missing resources, malformed data, and
mixed-quality traffic. When the workload only sends well-formed requests, the
error handling paths and mixed-validity interactions are never exercised.

Per-run variation in input quality: sometimes all valid, sometimes all invalid
(junk keys, malformed values, operations on non-existent resources), sometimes
mixed. The mix ratio is a per-run parameter.

### Hardcoded bounds with no variation

Ranges are narrowed (e.g., key sizes always 1-100) without awareness that the
system accepts a wider domain, and there is no mechanism to sometimes explore
outside the narrow range.

Behavior at the extremes is often where bugs live — integer overflow, buffer
sizing, performance cliffs, allocation failures.

Deliberate biasing rather than accidental narrowing: "90% of the time keys
are small" is a fine policy if the other 10% explores the wide space, and if
that bias point varies per run.

### No type-aware boundary exploration

Generated values stay in the "comfortable middle" — small positive integers,
short ASCII strings, modest payloads. The generator never targets type
boundaries.

Bugs cluster at boundaries — integer overflow at 2^31-1, empty string
handling, zero-length payloads, maximum-length keys. Per-run variation in
which boundaries to target. Include type-specific special values: 0, -1,
MAX_INT, MIN_INT, empty string, null bytes, very long strings.

### No payload size variation across orders of magnitude

All payloads are roughly the same size — always ~1KB, always 10 items.
There's randomness in exact size but within a narrow band.

System behavior has phase transitions at different scales — buffer
reallocation at 4KB, page boundaries at 64KB, different algorithms for small
vs. large collections. Per-run size should vary by orders of magnitude:
empty, 10 bytes, 10KB, 10MB.

This is distinct from "hardcoded bounds" — that's about the *value* range,
this is about the *physical size* of data being transmitted.

### Fixed/hardcoded values

Inputs always use the same literal values — always key "foo", always size 10,
always user ID 1. The system is tested against exactly one point in the input
space.

Generated values with per-run variation in generation parameters — character
sets, length distributions, numeric ranges.

### Small fixed pools with no per-run variation

Inputs are drawn from a small fixed set (e.g., 5 keys) that doesn't change
across runs. State space is bounded by the pool size regardless of how many
runs execute.

Pool size should vary per run. Some runs use 5 keys, some use 5000, some use
1. And the pool contents should vary — not always the same 5 keys.

### Uniform data shape / no structural variation

All generated data has the same structure — same nesting depth, same number of
fields, same collection sizes.

System behavior often depends on structural properties — recursion limits at
deep nesting, different code paths for sparse vs. dense structures, different
validation for present vs. absent optional fields. Vary structural parameters
per run.

### No null/missing/absent value variation

Optional fields are always present, nullable values always have a value,
arrays are never empty. The generator produces "complete" data every time.

Null handling, missing-field defaults, and empty-collection edge cases are
common bug sources. Per-run parameter controlling "completeness" — some runs
send fully populated data, some leave optional fields absent, some send null.

### Seed data always identical across runs

The system is always seeded with the same initial state — same 100 users,
same 50 products, same snapshot.

The initial state shapes what's reachable. Starting with 100 users vs. 0 vs.
1M hits different performance characteristics and code paths. Vary the
initial seed per run — different cardinalities, sometimes empty, sometimes
pre-populated.

### No encoding/representation variation

Strings always UTF-8, numbers always decimal, dates always ISO 8601. When the
system accepts multiple representations, only one parsing path gets tested.

Per-run variation in encoding: some runs UTF-8, some UTF-16, some mixed.

### Independent generation of semantically related fields

Fields that should be related are generated independently — start_time and
end_time each drawn from the full range, content_length and actual body size
unrelated.

The anti-pattern isn't inconsistency itself — sometimes you want inconsistent
fields to test error handling. It's having no control over whether fields are
consistent. Per-run parameter: sometimes all consistent, sometimes all
inconsistent, sometimes mixed.

### Single-locale / single-character-set generation

All string data is ASCII English. String handling bugs frequently depend on
character properties — multi-byte UTF-8, combining characters, string length
vs. byte length mismatches, collation differences.

Per-run character set variation: some runs ASCII, some mixed Unicode, some
targeting specific Unicode categories.

---

## Structural / Timing

### Fixed concurrency level

The workload always uses the same number of clients/threads/connections.

Many bugs only manifest under specific concurrency conditions: 1 client
(sequential correctness), 2 clients (basic race conditions), many clients
(resource exhaustion, thundering herd, contention). Concurrency should be a
per-run random parameter.

### Uniform operation pacing / no burst-quiet variation

Operations are issued at a steady rate (or as fast as possible) in every run.
No variation in inter-operation timing, no bursts followed by quiet periods.

Many systems have behavior that depends on load transitions: buffer flushes
on quiet periods, catch-up replication after bursts, timeout-triggered
elections during pauses. Per-run variation in temporal profile: some runs
constant-rate, some bursty with quiet periods.

### Always starting from empty state

Every run begins with a freshly initialized system. Bugs in transitions from
populated states (compaction, rebalancing, cache eviction, recovery from
accumulated state) are unreachable.

Vary the initial state per run. Some start empty, some with seed data of
varying sizes, some with "dirty" state.

### Monotonic state accumulation

State only grows (or only shrinks) across the entire run. Many interesting
bugs live at transitions: full table becoming empty, saturated pool draining,
warm cache going cold. Monotonic change crosses each threshold at most once.

Per-run variation in growth/shrinkage patterns: grow-then-shrink, oscillate,
spike-and-crash.

### Single fixed topology / system configuration

The workload always tests against the same cluster size, same replication
factor, same configuration flags.

System behavior varies dramatically with configuration — a 1-node cluster has
no replication bugs, a 5-node cluster has quorum edge cases a 3-node cluster
doesn't. This may be more of an infrastructure concern than a workload
concern, but note it when the workload has no mechanism to influence system
configuration.

---

## Composition / Multi-Workload

### Isolated workload components

Multiple components operate on completely separate slices of state — different
key prefixes, different tables. They never contend for the same resources.
Concurrency bugs, lock ordering issues, and consistency violations under
contention are invisible.

Per-run variation in how much components overlap: sometimes disjoint, sometimes
heavily overlapping, sometimes partial.

### All components use the same strategy

Multiple clients each running the same workload with the same parameters.
Homogeneous components produce synchronized behavior — same code paths at the
same time, never producing asymmetric conditions (one writing heavily while
another reads) that trigger real bugs.

Each component should draw its own per-run configuration independently.

---

## State Management

### Workload doesn't track its own state

The workload fires operations without remembering what it's done — random
puts and deletes with no record of which keys exist. Can't construct
meaningful sequences: intentional operations on existing vs. non-existing
resources, building toward complex dependent state.

This is distinct from a full oracle — it's just enough memory to enable
meaningful operation sequences ("keys I've put that I haven't deleted").
