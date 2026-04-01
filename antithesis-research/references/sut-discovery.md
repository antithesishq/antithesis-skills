# SUT Discovery

## Goal

Systematically build understanding of the system under test by examining it from
multiple independent perspectives. Each perspective (attention focus) looks at the
same codebase, docs, and issue history but prioritizes different aspects, producing
a richer analysis than a single unstructured pass.

This process produces the SUT analysis artifact. Each agent (or each pass in
single-agent mode) also uses the general methodology in `references/sut-analysis.md`
but filters its work through its assigned focus.

## Prerequisites

- The repo or codebase location is known
- Any user-provided documentation links, issue trackers, or design docs are available

## Attention Focuses

Each focus defines a lens for examining the system. Findings should be concrete
and specific — not "the system uses a database" but "PostgreSQL with synchronous
replication to one standby, async to a second."

### 1. Architecture and Data Flow

Map components, service boundaries, communication protocols, request paths from
ingress to persistence. Look for: entrypoints, middleware chains, internal RPCs,
message passing patterns, data serialization boundaries.

### 2. State Management and Persistence

Databases, caches, queues, in-memory state, replication, consistency guarantees.
Look for: what is stored where, how state moves between components, what happens
to in-flight state during failures, persistence boundaries, cache invalidation
strategies.

### 3. Concurrency Model

Threading, async patterns, locking, shared mutable state, synchronization
primitives. Look for: thread pools, event loops, lock ordering, lock-free data
structures, channels, shared mutable globals, concurrent access to collections.

### 4. Safety Guarantees

Explicitly claimed invariants the system promises will never be violated. Look for:
statements in docs, comments, or design docs like "acknowledged writes survive
failover," "exactly one leader per partition," "no duplicate processing," "data is
never corrupted." These become the foundation of safety properties.

### 5. Liveness Guarantees

Progress properties the system promises will eventually hold. Look for: statements
like "failover completes within X seconds," "queued work is eventually processed,"
"clients eventually get a consistent view," "the system recovers automatically."
These become the foundation of liveness properties.

### 6. Bug History and Density

Map where bugs have clustered and where they haven't. Look for: components with
many filed issues (hotspots), components with no bug history (suspiciously quiet —
possibly undertested rather than correct), recently closed bugs (regression targets
where the fix may not cover all edge cases), recurring bug patterns that suggest
systemic issues.

### 7. Existing Test Strategy

What kinds of tests exist and what do they actually exercise. Look for: unit tests,
integration tests, end-to-end tests, chaos/fault injection tests, load tests. For
each category: what scenarios do they cover, what do they mock or stub out, what
failure modes do they explicitly not test. The goal is understanding where Antithesis
adds value rather than duplicating existing coverage.

### 8. Failure and Degradation Modes

Error handling patterns, retry logic, timeout handling, partial failure paths,
degraded operation. Look for: catch-all error handlers, retry loops without
backoff, hardcoded timeouts, circuit breakers, fallback paths, graceful degradation
logic, health check implementations. Focus on the messy states between "fully up"
and "fully down."

### 9. External Dependencies and Integration Points

Third-party services, databases, message brokers, DNS, sidecars, cloud provider
APIs. Look for: points where the system's behavior depends on something it doesn't
control, how failures in dependencies are handled (or not), timeout and retry
policies for external calls, fallback behavior when dependencies are unavailable.

### 10. Product Context

What the product does from a user's perspective, what workflows matter most, what
a user-visible failure looks like. Look for: user-facing documentation, API docs,
CLI help text, UI flows, onboarding guides. The goal is grounding the technical
analysis in real-world impact — a bug in a rarely-used admin endpoint matters less
than one in the critical write path.

### 11. Unproven Assumptions

Implicit axioms the system is built on that are never validated. Look for: error
paths that don't exist, dependencies with no failure handling, comments like "this
shouldn't happen," catch blocks that log and swallow, hardcoded timeouts with no
rationale, code that assumes a service is always reachable, assumptions about clock
synchronization, assumptions about message ordering. These are often the most
productive Antithesis targets because they represent conditions the developers never
tested.

### 12. Wildcard

The other 11 focuses have fixed lenses — they see what their descriptions tell
them to look for. This focus has no fixed lens. Its job is to find what they will
all miss: the weird, the novel, the thing that doesn't fit any category but matters
anyway. These are not principles — this focus is deliberately unconstrained.

1. **Know the covered territory.** The orchestrator provides a one-line summary of
   each other focus. Understand their territory. Your job starts where theirs ends.

2. **Look for the non-obvious.** System characteristics that are surprising,
   unusual, or don't fit standard categories. A component that's architecturally
   bizarre but works. A dependency relationship that seems backwards. A design
   choice that's technically sound but fragile in ways nobody discusses.

3. **Find missing concepts.** Not missing state management (Focus 2 handles that)
   or missing failure modes (Focus 8 handles that) — but missing *ideas*. A failure
   mode that doesn't fit any standard category. A system behavior that only emerges
   from the interaction of multiple components. A deployment assumption nobody
   documents.

4. **Cross-cut.** Issues that span multiple focuses but belong to none. Where
   concurrency assumptions interact with persistence guarantees. Where external
   dependency behavior affects the failure model in ways neither focus would surface
   alone. Where the test strategy creates false confidence about a guarantee.

5. **Question the frame.** The other focuses accept the system as presented and
   analyze its characteristics. You can question the presentation. Is the documented
   architecture how it actually works? Are there implicit invariants the system
   depends on that nobody states? Is there a subsystem everyone treats as reliable
   that probably isn't?

6. **Report what's odd.** If something strikes you as unusual, unexpected, or
   suspicious but you can't fully articulate why — report it anyway with your best
   attempt at why it feels wrong. A vague signal from the wildcard is still signal.

## Ensemble Mode

If your environment supports spawning sub-agents, run SUT discovery as an
ensemble — one agent per attention focus, in parallel.

### Agent Instructions

Spawn one agent per focus. Each agent receives:

- The general SUT analysis methodology from `references/sut-analysis.md`
- One attention focus (its full description and "look for" guidance from above)
- Access to the codebase, documentation, and issue tracker
- These instructions:

> Examine the system through the lens of your assigned attention focus, using the
> general methodology in `references/sut-analysis.md` as a guide. Produce concrete,
> specific findings — not vague summaries. If your focus yields little for this
> system, say so and explain why.

**Wildcard agent:** The wildcard agent (Focus 12) runs in parallel with the others
but receives different context. Instead of a "look for" list, it receives:

- The general SUT analysis methodology from `references/sut-analysis.md`
- The wildcard directives from its focus description above
- A one-line summary of each other focus, derived from the focus names and opening
  sentences above (e.g., "Focus 1: Architecture and Data Flow — maps components,
  service boundaries, communication protocols, and request paths"). Do not include
  the detailed "Look for:" lists — the wildcard should know what territory is
  covered, not how the others search it.
- Access to the codebase, documentation, and issue tracker

### Agent Output Format

Each agent returns:

- Findings organized by the focus area (concrete observations, not vague summaries)
- A brief note on what areas of the codebase, docs, and issues it examined
- Assumptions made or open questions encountered

### Synthesis

After all agents complete, synthesize into a single SUT analysis:

- **Merge structural findings:** Architecture, state, and concurrency findings
  form the factual backbone. Resolve contradictions by checking the code.
- **Consolidate guarantees:** Safety and liveness findings from multiple agents
  may overlap. Deduplicate, preferring the most precise phrasing.
- **Layer contextual findings:** Bug history, test strategy, product context, and
  unproven assumptions add depth to the structural analysis. Attach them to the
  relevant components rather than listing them separately.
- **Preserve unique observations:** Findings from only one agent are valuable —
  they represent what a single-pass analysis would have missed.
- **Record provenance:** Note which focus(es) surfaced each major finding.

## Single-Agent Mode

If your environment does not support sub-agents, work through the attention
focuses as a sequential checklist:

1. Read `references/sut-analysis.md` for general methodology.
2. For each attention focus 1–11 in order, make an explicit pass through the
   codebase, docs, and issues with that lens. After each pass, add findings to a
   running analysis document. If a focus yields little for this system, note why
   and move on.
3. Run the wildcard pass (Focus 12) last. Unlike the other passes, the wildcard is
   not a fresh examination — it deliberately builds on awareness of what the
   previous passes covered, looking for what they missed.
4. After all 12 passes, review the full analysis for gaps and consistency.
5. Organize into the final SUT analysis.

Treat each pass (1–11) as a fresh examination. Resist the pull to skip a focus
because earlier passes "already covered" that area — the point is to look at the
same system from different angles. The wildcard pass is the exception — it runs
last and uses knowledge of the covered territory to find gaps.

## Output

The output feeds into `antithesis/scratchbook/sut-analysis.md`.
