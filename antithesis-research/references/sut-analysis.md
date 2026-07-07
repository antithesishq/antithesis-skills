# SUT Analysis

## Goal

Build a comprehensive understanding of the system — its architecture, components, data flows, concurrency model, and fault tolerance claims. This understanding drives every downstream decision: which properties to test, how to deploy, and where bugs are most likely hiding.

## Codebase Exploration Strategy

- **Read entrypoints:** Find `main()` functions, HTTP/gRPC server setup, CLI argument parsing. These reveal the system's public surface.
- **Trace request paths:** Follow a request from ingress through middleware, business logic, and persistence. Note where state changes happen.
- **Identify service boundaries:** Which processes talk to each other? What protocols do they use? Where are the network calls?
- **Understand the data model:** What is stored, where, and how? What are the consistency guarantees? Is there replication?

## Research External Sources

Read the user-named external references gathered during scoping (see `SKILL.md` "Prerequisites and Scoping"). They are typically:

- **Architecture docs:** Reveal the intended design and the guarantees the system claims to make.
- **Open bugs (especially in target components):** Reported weaknesses. A bug report is one person's guess about a suspected defect and is often wrong about the cause — validate that each is a real system defect before building on it (see `references/validating-claims.md`). Once confirmed, Antithesis may find deeper variants.
- **Recently closed bugs (regression targets):** A fix that handles one case may miss related edge cases. These are high-value Antithesis targets. Confirm the real mechanism from the fix and discussion first — some issues close as "not a bug."
- **RFCs and design docs:** Reveal what developers know is hard. Sections labeled "future work" or "known limitations" are gold.
- **Production incident reports:** Show what actually breaks in practice, not just what might break in theory.

Everything here is a lead, not a fact: turn a source into an analysis statement or a property only after grounding it in primary evidence, and validate only what you build on. See `references/validating-claims.md`.

## Identify Claimed Properties

Every system makes guarantees. Extract them explicitly. Look for statements like:

- "Exactly one leader per partition at all times"
- "Acknowledged writes survive failover"
- "Reads are linearizable" / "Reads are eventually consistent within X seconds"
- "Automatic failover completes within Y seconds"
- "No data loss under semi-synchronous replication"

These claimed properties become properties for Antithesis to verify. A claimed guarantee is a claim to test, not a verified fact — don't state in the analysis that the guarantee holds; state that the system claims it and the property checks it. See `references/validating-claims.md`.

## Identify Attack Surfaces

Where do bugs hide? Focus your attention on these common patterns:

- **State transitions under concurrent faults:** What happens during failover with in-flight writes? What if two nodes both think they're the leader?
- **Polling/caching with stale data:** Topology watchers, health checks, DNS caches — anything that observes state asynchronously can act on outdated information.
- **Race conditions between control plane and data plane:** The control plane says "node B is the new leader" but data plane traffic is still going to node A.
- **Recovery from partial failures:** Some nodes down, not all. The system is in a degraded state — does it behave correctly?
- **Component interactions making things worse:** Monitoring overloading a sick node, recovery actions conflicting with each other, retry storms.
- **Runtime configuration changes under load:** What happens when you change a config value while the system is actively serving traffic?
- **Health reporting accuracy:** The system says "healthy" but can't actually serve requests. Clients trust the health check and send traffic anyway.

## Antithesis's Superpower Is Timing

Focus on bugs that depend on "what if X happens at exactly the wrong moment during Y." Antithesis automatically explores execution interleavings. The most valuable properties are those that only fail under specific timing conditions:

- A write arriving during a leader election
- A config reload happening mid-request
- A health check passing right before a process crashes
- Two clients reading and writing the same key in overlapping transactions

## Think About Partial Failures

Not just "node is up or down" but the messy states in between:

- Process is down but sidecar is up
- Network partitioned to some peers but not others
- Disk is slow but not dead
- CPU starved but not OOM-killed
- Connection pool exhausted but process is "healthy"

These partial failure modes often reveal the most interesting bugs because systems are typically designed for clean failure, not degraded operation.

## Output

Write the analysis to `antithesis/scratchbook/sut-analysis.md`. Begin with provenance frontmatter (see `references/scratchbook-setup.md`).
