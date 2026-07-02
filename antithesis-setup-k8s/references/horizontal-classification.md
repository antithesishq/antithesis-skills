# Horizontal Classification

## Goal

Classify every component visible in the customer's manifests into one of four categories:

- **SUT** — what's being tested. Run for real. Apply vertical minimization to strip platform/cloud cruft, but the SUT itself keeps functioning.
- **Dependency — real** — something the SUT calls (or something that calls the SUT) where the test exercises the SUT's behavior in ways that depend on the dependency actually functioning. The dependency runs for real but is itself minimized.
- **Dependency — stub** — something the SUT calls (or something that calls the SUT) where a fake response from setup is sufficient for the test. The dependency does not run; setup constructs a stub that returns canned answers.
- **Out of scope** — components in the manifests that aren't part of the SUT or its test-relevant dependencies. Drop entirely.

The "no archaeology" principle applies here twice over: classification is built from research scope plus inferred call graph, and we don't interrogate components that don't show up as connected to the SUT.

## Process

Six steps. Ask the user when confidence is low or an interaction cannot be inferred; Record answers in the working file's `Open questions & answers` section.

### 1. Identify the SUT

Read the working file's Application overview. If it's empty, check `antithesis/scratchbook/sut-analysis.md` created by `antithesis-research` skill. Map the named SUT components to manifest entries.

If the SUT named in research doesn't obviously map to a single manifest component, ask the customer once which manifest entry corresponds. Record the mapping in the working file.

### 2. Build a call graph from the manifests

Three confidence tiers. Document edges by tier in the working file's *Horizontal classification* section.

**High confidence — direct evidence:**

- `Service` definitions and the workloads selecting them (selector → labels)
- Env vars containing service references (e.g., `DB_HOST=postgres.svc.cluster.local`, `AUTH_API_URL=auth-service:8080/api`)
- ConfigMap entries that reference services
- Init container `wait-for` style dependencies (often invoke `nslookup`, `nc`, or shell scripts naming services)
- PVC claims and the StorageClass they reference
- Sidecar references in pod specs (Istio `proxy`, `vault-agent-injector`, etc.)

**Lower confidence — inferred:**

- Naming conventions (e.g., `frontend` → `backend` → `db` follows a typical pattern)
- NetworkPolicy `allow` rules (when present, they often reveal intended traffic)
- Secret references suggesting auth to a known service
- Service mesh routing rules (Istio `VirtualService`, `DestinationRule`)

**Cannot be inferred from manifests — ask:**

- Async messaging (queues, pub/sub, event buses)
- Indirect dependencies through shared databases (write/read patterns)
- Hardcoded URLs baked into container images
- Scheduled jobs that touch the SUT
- Backend services hit through shared API gateways

For non-inferable interactions, ask the user exactly one structural question inline:

> From the manifests, the SUT calls <A, B, ...>. Are there interactions I can't see from the manifests — async messaging via queues/pub-sub, scheduled jobs that trigger the SUT, indirect dependencies through a shared database or cache, or backend services reached through a shared gateway?

Record the question and the user's answer under *Open questions & answers* in the working file, then act on it:

- **No / nothing else** → proceed with the current classification.
- **Yes, here are the others** → promote those components from out-of-scope into Dependency candidates and re-classify.
- **Don't know** → proceed assuming the manifests are complete; record it as an open item (Status: `Open`) so setup or runtime can catch a missing interaction if it breaks.

### 3. Classify by reachability from SUT

For each component:

- Direct dep (SUT calls it, or it calls the SUT during the test flow) → *Dependency* candidate
- Transitive dep (something the SUT's direct deps call, but the SUT doesn't touch) → *Out of scope*, default
- No path to SUT in the inferred graph → *Out of scope*

When in doubt, drop. False drops are cheap to revert.

### 4. Decide stub vs. real for dependencies

Default heuristics. Apply unless the customer explicitly overrides.

- **Database** → run real. Databases are usually testable in isolation, often what's being exercised, and stubbing them is more work than running a real instance.
- **Microservice** → stub. Less work than running real, often sufficient for the SUT's behavior under test.
- **Cloud-managed service (e.g., AWS Secrets Manager, GCP Pub/Sub)** → stub. No choice — can't run cloud locally.
- **Message queue / streaming platform (Kafka, RabbitMQ)** → run real. Stubs can't easily reproduce the behaviors that matter (ordering, partitioning, consumer groups). Use a lightweight protocol-compatible alternative if available (Redpanda for Kafka).
- Customer says "we want to test integration with X" → run real
- Customer says "X is just a downstream we call" → stub

If the heuristic conflicts with the customer's explicit input, the customer wins. Record the override in the working file.

### 5. Identify call-graph gaps

Any component whose classification depends on a non-inferable interaction (item 2's "ask" tier) gets flagged as `Open` until ops answers the structural question. Don't promote `Open` to `Defaulted` here; defaults apply to things we *could* infer but chose to act on. `Open` means "we genuinely don't know."

### 6. Record in the working file

Write the classification to the *Horizontal classification* section of `working.md`. For each component:

```markdown
- **<component-name>** — <SUT | Dependency-real | Dependency-stub | Out-of-scope>
  - Status: <Confirmed | Defaulted | Open>
  - Reasoning: <one or two sentences of why>
```

## Edge Cases

### Transitive chains: SUT → A → B → C

Default: `A` is dep, `B` and `C` are out-of-scope.

Reasoning: if `A` is stubbed, the stub returns canned data and `B`/`C` are never called. If `A` is real, `B`/`C` might be called but aren't being tested — exercising them isn't the goal.

Override: customer says "we want to test the full chain end-to-end." Then `B` and `C` become deps too. Record the override and the customer's reason.

### Shared infrastructure (database, queue, cache used by multiple services)

Common pattern: SUT and another service both write to and read from the same database, but the test only cares about the SUT's behavior.

Default: pre-populate test data the SUT needs, drop the writer service. Setup constructs initial state; the SUT runs against it without the writer being live.

Override: customer wants producer/consumer integration in the test (e.g., they're testing how SUT reacts to data the writer produces). Then the writer becomes a dep too — usually run-real, sometimes stubbed.

### Reverse dependencies (things that call the SUT)

Examples: cron jobs that trigger the SUT every minute, controllers from other services that issue commands to the SUT, monitoring health-checkers.

Capture these *descriptively*: what triggers the SUT in prod, with what shape of input, on what schedule. Record under *Horizontal classification → Reverse dependencies (descriptive)* in the working file. Example entry:

```markdown
- **order-trigger-cron**
  - Triggers SUT in prod via: HTTP POST to `/orders` every minute
  - Payload shape: `{order_id: <uuid>, items: <list>}`
  - Status: Confirmed (verified from CronJob spec)
```

Do not write "test driver needed: cron-style every minute." That decision belongs to `antithesis-workload`, which reads this descriptive information and designs drivers against the property catalog. Workload may end up making something very different from the prod cron — flooded inputs, malformed data, fault-injected scenarios. The prod pattern is a fact, not a prescription.

### Operators and their products

A common pattern: the customer uses an operator (e.g., `postgres-operator`, `redis-operator`, `strimzi-kafka`) that watches a CR and creates the actual workload. The operator itself is platform machinery; the workload it creates may be SUT-critical.

Classification:

- The operator → vertical-platform-cruft, drop (handled in vertical classification)
- The thing the operator produces → its own component entry, classified normally (typically dep-real if it's a database)

In the working file's *Component inventory*, the operator-produced thing should be described in primitives terms (StatefulSet, Service, ConfigMap, etc.) rather than as a CR. The recipe for converting comes from `references/operator-recipes.md`. Vertical classification handles the actual conversion; Horizontal classification only needs to flag that the operator-produced component exists and what its role is.

## Output

Working file *Horizontal classification* section, fully populated, with status fields per component. Any questions asked to the user are recorded under *Open questions & answers* in the working file.

