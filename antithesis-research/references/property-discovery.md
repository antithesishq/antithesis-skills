# Property Discovery

## Goal

Systematically discover testable properties by examining the system from multiple
independent perspectives. Each perspective (attention focus) looks at the same
codebase but prioritizes different failure modes, producing properties that a
single unstructured pass would miss.

This process runs after the SUT analysis is complete and produces candidate
properties in the standard catalog format defined in `references/property-catalog.md`.

## Prerequisites

- `antithesis/scratchbook/sut-analysis.md` exists and is current

## Attention Focuses

Each focus defines a lens for examining the system. Every focus should produce
properties in the standard catalog format.

### 1. Data Integrity

Consistency guarantees, invariants on stored state, corruption paths. Look for:
write ordering assumptions, transaction boundaries, constraint enforcement, data
loss scenarios under concurrent access.

### 2. Concurrency

Races, atomicity, ordering dependencies, shared mutable state. Look for: lock
ordering, TOCTOU patterns, concurrent container access, thread-safety assumptions
in documentation vs. implementation.

### 3. Failure Recovery

Crash recovery, restart correctness, partial failure handling, retry semantics.
Look for: incomplete operations that survive restarts, recovery procedures that
assume clean state, retry storms, idempotency gaps in recovery paths.
Also note candidate SUT instrumentation points for retry outcomes, recovery
subphases, and dangerous internal fallback paths that workloads may not observe
cleanly.

### 4. Protocol Contracts

API guarantees, message ordering, schema validation, backward compatibility. Look
for: documented API guarantees that aren't enforced, ordering assumptions between
services, response codes that mask errors.

### 5. Resource Boundaries

Exhaustion, leaks, backpressure, capacity limits, queue depths. Look for:
unbounded queues, missing backpressure, file descriptor leaks, memory growth under
sustained load, connection pool exhaustion.

### 6. Security Boundaries

Authentication/authorization invariants, privilege escalation paths, input
validation. Look for: operations that bypass auth checks, role escalation through
sequences of valid operations, injection points.

### 7. Distributed Coordination

Consensus, leader election, split-brain, network partition behavior, replication.
Look for: split-brain recovery, replication lag visibility, quorum loss handling,
stale leader commands. May yield no properties for single-process systems.
Also note candidate SUT instrumentation points for redirect emission, leader
handoff, stepdown, and leadership-loss retry internals.

### 8. Lifecycle Transitions

Startup, shutdown, upgrade, migration, initialization ordering. Look for: requests
during startup before subsystems are ready, graceful shutdown that drops in-flight
work, migration steps that assume no concurrent traffic.
Also note candidate SUT instrumentation points for distinct lifecycle outcomes,
not just broad "entered startup/shutdown path" markers.

### 9. Idempotency and Replay

Duplicate handling, at-least-once delivery, reprocessing safety. Look for: side
effects on retry, message deduplication gaps, replay of already-applied operations.

### 10. Version Compatibility

Behavioral differences across client/server version combinations, backward/forward
compatibility guarantees, deprecation boundary correctness. Look for: changed
serialization formats, removed/renamed fields, different default values across
versions, protocol negotiation failures.

## Ensemble Mode

If your environment supports spawning sub-agents, run property discovery as an
ensemble — one agent per attention focus, in parallel.

### Agent Instructions

Spawn one agent per focus. Each agent receives:

- The contents of `antithesis/scratchbook/sut-analysis.md`
- The property catalog format from `references/property-catalog.md`
- One attention focus (its full description and "look for" guidance from above)
- These instructions:

> Examine the codebase through the lens of your assigned attention focus. Produce
> properties in the standard catalog format. For each property, include your
> confidence (high/medium/low) and what evidence in the codebase supports it. If
> this focus yields no relevant properties for this system, say so and explain why.

### Agent Output Format

Each agent returns:

- Properties in catalog format (may be empty)
- Per-property evidence: for each property, the specific code paths examined
  (files, functions, line numbers), the failure scenario, key observations, and
  any open questions with context on why they matter and what the answer would
  change. This per-property evidence is the primary input for writing evidence
  files during synthesis — capture everything a future reader would need to
  understand why this property was identified and how the code is involved.
- A brief note on what areas of the codebase it examined beyond specific properties
- Assumptions made that affect multiple properties

### Synthesis

After all agents complete, synthesize into a single property catalog:

- **Deduplicate:** Multiple agents finding the same property is a confidence
  signal. Merge duplicates, noting which focuses identified them.
- **Preserve unique finds:** Properties found by only one focus are the primary
  value of the ensemble — don't drop them without cause.
- **Resolve conflicts:** When agents disagree on assertion type or priority for
  the same property, evaluate which reasoning is stronger. Note the disagreement
  and resolution in the property's rationale.
- **Assign slugs and organize:** Assign a descriptive kebab-case slug to each
  property and group into categories per the catalog format. The slug is the
  canonical ID — see `references/property-catalog.md` for details.
- **Record provenance:** For each property, note which focus(es) surfaced it.
- **Write evidence files:** For each property, write an evidence file to
  `properties/{slug}.md` in the scratchbook. Capture the supporting evidence,
  relevant code paths, failure scenario, and key observations from the agent
  outputs. These files are freeform markdown — write whatever context would help
  a future reader understand why this property was identified and what code is
  involved.
- **Write property relationships:** Review the complete property set and write
  `property-relationships.md` in the scratchbook. Group properties that share
  evidence, code paths, or failure mechanisms into clusters. Note any suspected
  dominance (where one property likely implies another). This is lightweight —
  flag connections you noticed during synthesis, don't do deep analysis.

## Single-Agent Mode

If your environment does not support sub-agents, work through the attention
focuses as a sequential checklist:

1. Read the SUT analysis.
2. For each attention focus in order, make an explicit pass through the codebase
   with that lens. After each pass, add new properties to a running catalog. If a
   focus yields nothing for this system, note why and move on.
3. After all 10 passes, review the full catalog for duplicates, gaps, and
   consistency.
4. Assign a descriptive kebab-case slug to each property and organize into final
   form per the catalog format.
5. For each property, write an evidence file to `properties/{slug}.md` in the
   scratchbook. Capture the supporting evidence, relevant code paths, failure
   scenario, and key observations you encountered during your passes. Write
   whatever context would help a future reader understand why this property was
   identified and what code is involved.
6. Review the complete property set and write `property-relationships.md` in the
   scratchbook. Group properties that share evidence, code paths, or failure
   mechanisms into clusters. Note any suspected dominance relationships. This is
   lightweight — flag connections you noticed during the passes, don't do deep
   analysis.

Treat each pass as a fresh examination. Resist the pull to skip a focus because
earlier passes "already covered" that area — the point is to look at the same code
from different angles.

## Output

- `antithesis/scratchbook/property-catalog.md` — using the format defined in
  `references/property-catalog.md`
- `antithesis/scratchbook/properties/{slug}.md` — one per cataloged property
- `antithesis/scratchbook/property-relationships.md` — suspected clusters and
  connections
