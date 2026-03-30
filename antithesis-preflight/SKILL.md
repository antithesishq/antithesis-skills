---
name: antithesis-preflight
description: >
  Fast suitability and readiness gate before committing to Antithesis
  integration. Checks project fit, deployment readiness, and estimates
  effort so bad candidates are caught before research begins.
keywords:
  - antithesis
  - preflight
  - suitability
  - qualification
  - readiness
  - screening
---

# Antithesis Preflight

## Purpose and Goal

Determine whether a project is a good candidate for Antithesis testing before investing in research, setup, and workload work. This skill is a fast gate — it should take minutes, not hours.

Success means:

- A clear verdict is presented to the user: **suitable**, **limited**, or **not suitable**
- The verdict is backed by concrete evidence from the codebase and public information
- Bad candidates are caught early, before `antithesis-research` begins

Run this skill before `antithesis-research`. If the verdict is **not suitable**, do not proceed to research unless the user explicitly overrides.

This skill does not write files to the target repository. The verdict is presented directly to the user.

## Prerequisites

- A codebase to evaluate. The repo should be checked out and accessible.
- Ask the user for the repo location if it is not already clear.
- No other Antithesis skills need to have run first — this is the entry point.

## Workflow

The evaluation is a single pass through four lenses, in order. Stop early if a disqualifier is found.

1. **Check disqualifiers** — scan the codebase for hard-no signals. If any are found, present the verdict and stop.
2. **Assess suitability** — evaluate the project's business context, architectural complexity, and how well it maps to Antithesis's strengths.
3. **Assess existing testing and containerization** — scan for test infrastructure, CI/CD, container images, and orchestration.
4. **Estimate effort and risk** — based on what exists and what's missing, characterize the work ahead.
5. **Present the verdict** — deliver the qualification to the user using the output format below.

If your agent supports sub-agents, steps 2 and 3 can run in parallel since they examine different aspects of the codebase.

## Disqualifiers

These are hard stops. If any of these are true, the verdict is **not suitable** and the skill should explain why and what would need to change.

- **Single-process, no inter-service network communication.** Antithesis's core value is fault injection across distributed components — network partitions, process kills, clock skew between services. A single-process application, no matter how complex its internal logic, will not benefit meaningfully from Antithesis. Look for: only one `main` entrypoint, no service-to-service RPC or messaging, no multi-container deployment topology. This is the most common false positive — a project can have sophisticated business logic but still be a single process.

- **Pure library with no runtime.** Nothing to deploy, no processes to fault-inject. Look for: no `main` package or entrypoint, no server/daemon mode, README describes it as a library or SDK.

- **Cannot run hermetically.** Antithesis runs with no internet access. If the system has a hard runtime dependency on an external API that cannot be mocked, stubbed, or replaced with a local alternative, it cannot run in Antithesis. Look for: required external auth at boot, mandatory SaaS API calls with no offline mode, license-check phone-home. Note: standard infrastructure dependencies (Postgres, Redis, Kafka, S3) are fine — these have well-known container images. The concern is proprietary services with no local substitute.

- **Frontend-only application.** No backend state, no distributed behavior, nothing for Antithesis to fault-inject. Look for: React/Vue/Angular SPA with no accompanying backend in the repo.

- **LLM-driven core behavior.** If the system's correctness story depends entirely on non-deterministic LLM output, there's nothing to assert against. However, systems that _orchestrate_ LLM calls with deterministic coordination logic (retry, routing, queuing, deduplication) are fine — test the coordination, not the LLM. The disqualifier applies when there are no meaningful properties to write that don't depend on what the LLM said.

- **Cannot target x86-64 Linux.** Antithesis runs on x86-64 Linux. Most server-side software already does this or is trivially cross-compiled — only flag this if the codebase has positive evidence of platform lock-in (Windows-only, ARM-only with no multi-arch, macOS frameworks with no Linux target).

### Edge cases

- **Single process with embedded distributed components** (e.g., a binary that runs an embedded etcd or raft consensus): this is _not_ disqualified — the distributed behavior lives inside the process. Note this in the verdict. Normal language-level concurrency (goroutines, threads, mutexes, channels) does **not** qualify as "embedded distributed components" — every concurrent program has these.
- **Monorepo containing both libraries and services**: evaluate the services, not the libraries.
- **System that _could_ be distributed but is deployed as a single process**: note the gap. The project may be suitable if it has a multi-service deployment mode.

## Technical Suitability Assessment

Evaluate the project across the following dimensions. For each, record specific evidence — not guesses.

### Business Context and Reach

Understand what the project does, who uses it, and whether finding bugs in it matters. Use a combination of repo inspection and web search:

- **What the project does** — read the README, docs, and marketing site. Summarize the product's value proposition in one sentence. A web search for the project or company name can surface business context not in the repo.
- **Who uses it** — production adopters, known customers, or stated user base. Look for ADOPTERS files, case studies, or "used by" sections in docs.
- **GitHub signal** — stars, forks, contributor count, release cadence, recent commit activity. These are rough proxies for reach and maintenance health.
- **Business criticality** — is this infrastructure software (databases, message brokers, orchestrators) where bugs cause outages? Financial software where bugs cause data loss? The higher the blast radius of a bug, the better the Antithesis fit.
- **Open source vs. proprietary** — check for a LICENSE file. Open-source projects are easier to onboard (full code visibility, public issue trackers). Proprietary projects require closer customer collaboration.

Record what you find. There is no hard threshold — a small but critical infrastructure project (e.g., a consensus library used by a major database) can be highly suitable despite low star count. Use judgment.

### Architectural Complexity

This is the most important dimension. Antithesis is strongest when the system has:

- **Multiple communicating services** — the #1 signal. Look for: docker-compose with >1 service, microservice architecture, internal RPCs, message queues, service mesh. Count the services and note how they communicate (HTTP, gRPC, message bus, shared database).
- **Persistent distributed state** — databases with replication, distributed caches, consensus protocols, shared storage. The more state that crosses process boundaries, the more interesting the failure modes.
- **Claimed safety or liveness guarantees** — documentation, comments, or issue discussions mentioning "exactly-once", "no data loss", "linearizable", "leader election", "consistent reads", "at-least-once delivery". These are directly testable with Antithesis assertions.
- **Concurrency with shared mutable state** — goroutines, thread pools, async workers accessing shared data, lock ordering, channels. Antithesis's deterministic scheduling can find races that conventional testing misses.
- **Failure and recovery logic** — retries, failover, circuit breakers, leader re-election, replica promotion, graceful degradation. This code is notoriously hard to test conventionally and is exactly where Antithesis shines.
- **Timing-sensitive operations** — timeouts, TTLs, leases, distributed locks, heartbeats. Antithesis's clock skew injection targets these directly.

Score the overall architectural fit:
- **Strong fit**: multiple services with distributed state and claimed guarantees
- **Moderate fit**: 2-3 services with some distributed behavior, or a single service with embedded distributed protocols (e.g., built-in raft, paxos, or gossip — not just goroutines and mutexes)
- **Weak fit**: limited distribution, mostly request/response with no interesting failure modes

### Use-Case Fit

Characterize the primary use case to assess Antithesis alignment:

- **Strong use cases**: distributed consensus, data replication, leader election, transaction processing, distributed coordination, message delivery guarantees
- **Moderate use cases**: CRUD services with multiple backends, event-driven architectures, workflow orchestration
- **Weak use cases**: eventually consistent systems with no stronger guarantees, pure business logic, performance/benchmarking, load testing

### SDK and Language Support

Identify the primary language(s) used by the SUT. Antithesis has SDK and instrumentation support for: **Go, Rust, C, C++, Java, .NET, Python, JavaScript**. If the project uses an unsupported language, note this as a risk — it does not disqualify the project but limits instrumentation options.

### Candidate Properties Gut-Check

Before scoring suitability, attempt to name 2–3 candidate `Always` or `Sometimes` properties for this system based on what you've seen so far. These do not need to be precise — rough invariants are fine. Examples:

- "A committed transaction is never lost after a leader failover"
- "All replicas converge to the same state within N seconds of a write"
- "A job accepted by the scheduler is eventually executed exactly once"

If you cannot name any candidate properties after reviewing the architecture and claimed guarantees, that is a strong signal the system is **not suitable** or at best **limited** — even if it is architecturally distributed. A system with no articulable invariants gives Antithesis nothing to assert against.

Record the candidate properties in the output. They will be refined during `antithesis-research`.

## Existing Testing and Containerization

Scan the codebase to understand the project's current testing maturity and container readiness. These directly affect the effort to onboard to Antithesis and the gap Antithesis fills.

### Testing Methodology

Scan for existing test infrastructure. The goal is to understand what testing exists today and where Antithesis adds value versus duplicating effort.

- **Unit tests** — look for `*_test.go`, `*_test.py`, `*.test.ts`, `*.spec.js`, `tests/unit/`, `src/test/`, etc. Note the framework (go test, pytest, jest, JUnit, etc.) and rough coverage.
- **Integration tests** — look for `tests/integration/`, `e2e/`, `tests/e2e/`, or test files that spin up real dependencies (database connections, HTTP clients hitting other services). These are the most relevant to Antithesis — they show what behaviors the team already considers important.
- **End-to-end tests** — look for tests that exercise the full system through external APIs. These often reveal the workload patterns Antithesis test commands should mimic.
- **Other testing methods** — look for fuzzing configs (`fuzz_test.go`, `corpus/`, `oss-fuzz`), load testing (`k6`, `locust`, `gatling`), chaos testing (`chaos-mesh`, `litmus`, `toxiproxy`). Existing chaos or property-based testing is a strong signal the team already thinks in Antithesis-compatible terms.
- **CI/CD pipeline** — check `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, `.circleci/`. Note what tests run automatically and at what cadence. A project with strong CI but no fault testing has a clear gap Antithesis fills.
- **Testing focus** — is the testing focused on correctness and safety, or on performance and benchmarks? Performance-focused testing (benchmarks, load tests, latency measurement) is not well-suited for Antithesis. Correctness-focused testing (invariants, assertions, integration contracts) aligns well.

### Containerization

Determine what container infrastructure already exists:

- **Container images** — look for Dockerfiles: `Dockerfile`, `Dockerfile.*`, `*.dockerfile`, in repo root and subdirectories. Note which services have images and which don't.
- **Public registry** — check if images are published to Docker Hub, GHCR, or other registries. Look for CI steps that push images, or references in README. Published images simplify Antithesis setup.
- **Orchestration** — scan for docker-compose files (`docker-compose.yaml`, `docker-compose.yml`, `compose.yaml`, `compose.yml`) and Kubernetes manifests (`k8s/`, `helm/`, `charts/`, `manifests/`, `deploy/`). Check `infra/`, `.docker/`, `ops/` as well — these are often buried.
- **Dependencies containerizable** — list the infrastructure dependencies (databases, caches, message brokers). Standard images (postgres, redis, kafka, minio) are fine. Proprietary or licensed binaries need special handling — flag these.
- **Other orchestration** — note if the project uses Kurtosis, Earthly, Tilt, Skaffold, or similar. These indicate container maturity but require translation to a compose-based topology for Antithesis. If custom orchestration is the _only_ orchestration (no compose, no k8s), flag this prominently — in practice, custom-only orchestration often translates to a no-go for a short engagement unless the team is willing to help produce a compose equivalent.
- **Health or readiness endpoints** — `/health`, `/ping`, `/ready`, gRPC health check. These are needed for `setup_complete` wiring in Antithesis.
### Containerization readiness verdict

- **Ready**: docker-compose with all services, Dockerfiles exist, standard dependencies
- **Partial**: some deployment artifacts exist, gaps are clear and fillable
- **Needs creation**: no container orchestration, Dockerfiles need to be written from scratch

## Effort and Risk Estimation

Based on the assessment above, characterize the work ahead. This is not a time estimate — it describes what work needs to happen and what might go wrong.

### Setup effort

Factors that increase effort:
- No existing container orchestration (need to create docker-compose from scratch)
- Many services (each needs a Dockerfile, instrumentation, and inclusion in the topology)
- Polyglot codebase (multiple languages means multiple instrumentation paths)
- Complex initialization sequence (services with ordering dependencies, migrations, seed data)
- Cloud provider coupling (AWS SDK calls, GCP Pub/Sub, Azure services that need local substitutes)
- No health endpoints (need to add them or find alternative readiness signals)
- Large system footprint (20+ containers puts pressure on Antithesis environment resources)

Factors that decrease effort:
- Clean docker-compose already exists
- Single language across all services
- Standard infrastructure dependencies (Postgres, Redis, Kafka)
- Health endpoints already exist
- Images already published to a public registry

### Workload effort

- **Existing tests are portable** — if integration or e2e tests exist and can be adapted into test commands with minor refactoring, workload creation is straightforward.
- **Tests need major rework** — if existing tests are tightly coupled to CI, mock everything, or don't exercise real service interactions, new workload code needs to be written.
- **No relevant tests exist** — workload must be built from scratch based on API analysis. Higher effort but also higher Antithesis value (the testing gap is wide).
- **API surface accessibility** — regardless of existing tests, check whether the system has a documented API (REST, gRPC, CLI, client library) that an external workload can drive traffic through. A system with a clean, documented API is straightforward to build workloads for even if no tests exist. A system with an undocumented proprietary binary protocol or no external-facing API is significantly harder — flag this as a workload risk.

### Risks

Flag any of the following if present:
- **Complex dependency chain** — external or internal dependencies the evaluating team may not control or fully understand
- **Kubernetes-only orchestration** — the project only has k8s manifests, no docker-compose. Antithesis supports both but compose is simpler to start with.
- **Custom orchestration** — the project uses custom scripts or tools (Kurtosis, Earthly, etc.) to bring up containers. May need translation to docker-compose.
- **Large system footprint** — estimate the container count. 20-30+ containers correlates with higher resource usage in Antithesis.
- **No readily available workloads** — no existing tests that can be adapted, workload must be built from scratch.
- **No external API surface** — no documented API, CLI, or client library to drive traffic through. Workload creation will be significantly harder.
- **Custom-only orchestration** — the project uses only custom scripts or tools (Kurtosis, Earthly, etc.) to bring up containers. This often requires significant translation effort and may be a no-go for a short engagement.

## Verdict Categories

### Suitable

Passes all disqualifier checks. Architectural fit is moderate or strong. Containerization is at least partial. SDK support covers the primary services. At least 2–3 candidate properties can be articulated. Workload path is identifiable (existing tests to adapt, or clean API to target).

### Limited

Passes all disqualifier checks, but has significant caveats that constrain the engagement. Canonical examples:

- Suitable architecture but non-hermetic dependencies that are theoretically mockable but obviously high-effort to stub out.
- Single-service deployment with embedded distributed protocol (raft, etc.) but no meaningful failure-handling code exercised yet.
- Strong architecture but no workloads and no documented API surface, so workload creation dominates the effort.
- Custom-only orchestration that would need substantial translation to compose.
- Cannot articulate more than one rough candidate property despite distributed architecture.

### Not suitable

Any disqualifier is triggered. Alternatively, the system technically passes all disqualifier checks but is practically impossible to run in Antithesis (e.g., dozens of proprietary dependencies with no local substitutes, even though no single one is a hard blocker).

## Output

Present the verdict directly to the user. Do not write files to the target repository. Use the following structure:

```
# Antithesis Qualification

## Verdict: {suitable | limited | not suitable}

{1-2 sentence summary of the verdict and primary reasoning.}

## Disqualifier Check

{For each disqualifier, state whether it applies and the evidence.
If a disqualifier applies, this section explains why and what would need to change.}

## Technical Suitability

### Business Context and Reach
{What the project does, who uses it, business criticality, open source status.}

### Architectural Complexity
{Services found, communication patterns, distributed state, claimed guarantees.
Overall fit: strong/moderate/weak.}

### Use-Case Fit
{Primary use case and Antithesis alignment: strong/moderate/weak.}

### SDK and Language Support
{Primary language(s), SDK availability.}

### Candidate Properties
{2-3 rough Always/Sometimes properties, or note that none could be identified.}

## Existing Testing and Containerization

### Testing Methodology
{What tests exist (unit/integration/e2e/other), frameworks, CI pipeline, testing focus.
Where does Antithesis add value vs. duplicate effort?}

### Containerization
{What container artifacts exist, where, orchestration type.
Overall: ready/partial/needs creation.}

## Effort and Risk

### Setup Effort
{What work is needed to get the system running in Antithesis.}

### Workload Effort
{How much work to create test commands and assertions. Low/medium/high.
Can existing tests be adapted, or must workload be built from scratch?
Is there a usable API surface?}

### Risks
{Dependency chain issues, orchestration complexity, footprint, workload gaps.}

## Recommendation

{Concrete next step. If suitable: proceed with `antithesis-research`.
If limited: proceed with caveats noted.
If not suitable: what would need to change, or suggest the project is not a fit.}

## Presales Intake Fields (Manual)

{List any presales intake form fields that require human input and could not
be determined from the codebase. For example: team knowledge of build process
and architecture, system guarantee knowledge, debugging sophistication.}
```

## General Guidance

- Be specific. Every claim in the verdict should point to a file, directory, or pattern found in the codebase. "The project has 3 services" is not enough — "The project has 3 services: `api-server`, `worker`, and `scheduler`, communicating via Redis Pub/Sub (see `docker-compose.yaml:L12-40`)" is.
- Do not over-research. This is a preflight check, not the full `antithesis-research` pass. Skim the architecture, don't trace every code path.
- A web search for the project name, company, or domain can surface business context (funding, customer base, industry) that is not in the repo. Use this to inform the business context section, but keep it brief.
- If a disqualifier applies, the verdict is **not suitable**. Do not soften it to **limited**. The disqualifiers exist precisely to prevent wasted effort. Reserve **limited** for projects that pass all disqualifier checks but have weak suitability signals or deployment gaps.
- If the project has an `antithesis/` directory already, note what exists — but do not treat prior Antithesis work as evidence of suitability. The prior work may have been a mistake or an incomplete attempt. Run the disqualifier checks regardless.
- Popularity alone does not make a project suitable. A popular single-process library is still not a fit.
- Complexity alone does not make a project suitable. A complex system that cannot run hermetically is still not deployable in Antithesis.

## Self-Review

Before declaring this skill complete, verify:

- The verdict was presented to the user, not written to a file in the repo
- The verdict is one of: **suitable**, **limited**, or **not suitable**
- Every disqualifier was explicitly checked with evidence, not skipped
- Suitability claims reference specific files, directories, or patterns in the codebase
- SDK/language support was checked against the supported language list
- At least 2–3 candidate Always/Sometimes properties were identified (or their absence was noted as a suitability concern)
- Existing testing methodology was scanned — not just "tests exist" but what kind and what's missing
- Containerization assessment names actual artifacts found (or their absence) with paths
- Orchestration type is explicitly categorized (compose / k8s-only / custom-only / none)
- Use-case fit is categorized as strong, moderate, or weak with reasoning
- API surface accessibility was checked — can an external workload drive traffic into this system?
- If the verdict is **not suitable**, the qualification explains what would need to change
- If the verdict is **limited**, the caveats are specific enough for the user to evaluate
- The effort estimation describes work needed, not time predictions
- Risks are flagged with specific evidence
- The "Presales Intake Fields (Manual)" section lists fields that require human input
- No section contains speculative claims without evidence from the codebase
