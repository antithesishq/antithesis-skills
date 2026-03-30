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
2. **Assess project and architecture** — understand what the project is, who uses it, and evaluate its distributed architecture and Antithesis fit.
3. **Assess readiness** — scan for test infrastructure, container images, orchestration, SDK support, and API surface.
4. **Estimate path to Antithesis** — based on what exists and what's missing, characterize the effort, risks, and next step.
5. **Present the verdict** — deliver the report to the user using the output format below.

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

## Project Overview

Understand what the project does, who uses it, and whether finding bugs in it matters. Use repo inspection and web search:

- **What it does** — read README, docs, marketing site. One-sentence value proposition.
- **Who uses it** — production adopters, customers, stated user base. Look for ADOPTERS files, case studies, "used by" sections.
- **GitHub signal** — stars, forks, contributor count, release cadence, recent activity. Rough proxies for reach.
- **Business criticality** — infrastructure where bugs cause outages? Financial software where bugs cause data loss? Higher blast radius = better Antithesis fit.
- **License** — open-source (easier onboarding) vs. proprietary (closer collaboration needed).

No hard threshold — a small but critical project can be highly suitable despite low star count.

## Architecture & Suitability

The most important analysis. Evaluate the project's distributed architecture and how well it maps to Antithesis's strengths.

### What to look for

- **Multiple communicating services** — the #1 signal. docker-compose with >1 service, internal RPCs, message queues, service mesh. Count services and note communication patterns (HTTP, gRPC, message bus, shared database).
- **Persistent distributed state** — replication, distributed caches, consensus protocols, shared storage. More state crossing process boundaries = more interesting failure modes.
- **Claimed safety or liveness guarantees** — "exactly-once", "no data loss", "linearizable", "leader election", "consistent reads", "at-least-once delivery". Directly testable with Antithesis assertions.
- **Failure and recovery logic** — retries, failover, circuit breakers, leader re-election, replica promotion, graceful degradation.
- **Timing-sensitive operations** — timeouts, TTLs, leases, distributed locks, heartbeats. Antithesis's clock skew injection targets these.

### Architectural fit

- **Strong**: multiple services with distributed state and claimed guarantees
- **Moderate**: 2-3 services with some distributed behavior, or a single service with embedded distributed protocols (built-in raft, paxos, gossip — not just goroutines and mutexes)
- **Weak**: limited distribution, mostly request/response with no interesting failure modes

### Use-case fit

- **Strong**: distributed consensus, data replication, leader election, transaction processing, distributed coordination, message delivery guarantees
- **Moderate**: CRUD services with multiple backends, event-driven architectures, workflow orchestration
- **Weak**: eventually consistent with no stronger guarantees, pure business logic, performance/benchmarking

### Candidate Properties

Attempt to name 2–3 candidate `Always` or `Sometimes` properties. Rough invariants are fine:

- "A committed transaction is never lost after a leader failover"
- "All replicas converge to the same state within N seconds of a write"
- "A job accepted by the scheduler is eventually executed exactly once"

If you cannot name any, that is a strong signal the system is **not suitable** or at best **limited**. A system with no articulable invariants gives Antithesis nothing to assert against. These will be refined during `antithesis-research`.

## Readiness

Scan the codebase for existing infrastructure that accelerates Antithesis onboarding.

### Testing

- **Unit tests** — `*_test.go`, `*_test.py`, `*.test.ts`, `*.spec.js`, `tests/unit/`, `src/test/`. Note framework and rough coverage.
- **Integration tests** — `tests/integration/`, `e2e/`, test files spinning up real dependencies. Most relevant to Antithesis.
- **End-to-end tests** — tests exercising the full system through external APIs. Reveal workload patterns.
- **Other methods** — fuzzing (`fuzz_test.go`, `oss-fuzz`), chaos testing (`chaos-mesh`, `litmus`, `toxiproxy`). Existing chaos/property-based testing = team already thinks in Antithesis terms.
- **CI/CD** — `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`. Strong CI + no fault testing = clear Antithesis gap.
- **Testing focus** — correctness (invariants, assertions, contracts) aligns well. Performance (benchmarks, load, latency) does not.

### Containerization

- **Dockerfiles** — `Dockerfile`, `Dockerfile.*`, `*.dockerfile` in root and subdirectories. Note which services have images.
- **Public registry** — Docker Hub, GHCR, etc. Published images simplify setup.
- **Orchestration** — docker-compose files, Kubernetes manifests (`k8s/`, `helm/`, `charts/`, `deploy/`). Also check `infra/`, `.docker/`, `ops/`.
- **Dependencies** — list infrastructure deps. Standard images (postgres, redis, kafka, minio) are fine. Proprietary binaries need flagging.
- **Custom orchestration** — Kurtosis, Earthly, Tilt, Skaffold. If this is the _only_ orchestration, flag prominently — often a no-go for short engagements.
- **Health endpoints** — `/health`, `/ping`, `/ready`, gRPC health check. Needed for `setup_complete` wiring.

Readiness: **Ready** (compose + Dockerfiles + standard deps) / **Partial** (some artifacts, clear gaps) / **Needs creation** (nothing exists).

### SDK and Language

Antithesis SDK and instrumentation support: **Go, Rust, C, C++, Java, .NET, Python, JavaScript**. Unsupported language = risk (not a disqualifier) that limits instrumentation.

### API Surface

Check for a documented API (REST, gRPC, CLI, client library) an external workload can drive. Clean documented API = straightforward workloads. Undocumented proprietary protocol = significant workload risk.

## Path to Antithesis

Characterize the work ahead — what needs to happen and what might go wrong.

### Setup effort

Increases effort: no container orchestration, many services, polyglot codebase, complex init sequence, cloud provider coupling, no health endpoints, large footprint (20+ containers).

Decreases effort: clean docker-compose exists, single language, standard dependencies, health endpoints exist, images published to registry.

### Workload effort

- **Low** — integration/e2e tests adaptable with minor refactoring
- **Medium** — tests tightly coupled to CI or mock-heavy, need significant rework
- **High** — no relevant tests, build from scratch based on API analysis (but high Antithesis value — testing gap is wide)

### Risks

Flag if present:
- **Complex dependency chain** — dependencies the team may not control
- **Kubernetes-only orchestration** — no docker-compose, only k8s manifests
- **Custom-only orchestration** — only Kurtosis/Earthly/etc. Often a no-go for short engagements.
- **Large system footprint** — 20-30+ containers
- **No available workloads** — must build from scratch
- **No external API surface** — no documented API to drive traffic through

## Verdict Categories

### Suitable

Passes all disqualifiers. Architectural fit moderate or strong. Containerization at least partial. SDK covers primary services. 2–3 candidate properties articulable. Workload path identifiable.

### Limited

Passes all disqualifiers, but significant caveats:
- Non-hermetic dependencies that are theoretically mockable but high-effort
- Embedded distributed protocol but no failure-handling code exercised
- Strong architecture but no workloads and no documented API
- Custom-only orchestration needing substantial translation
- Cannot articulate more than one rough candidate property

### Not suitable

Any disqualifier triggered. Or: technically passes all checks but practically impossible to run (e.g., dozens of proprietary dependencies with no local substitutes).

## Output

Present the verdict directly to the user. Do not write files to the target repository. Use the following structure:

```
# Antithesis Preflight: {project name}

## Verdict: {suitable | limited | not suitable}

{1-2 sentence summary of the verdict and primary reasoning.}

| Dimension | Rating |
|---|---|
| Architectural Fit | {Strong / Moderate / Weak} |
| Use-Case Fit | {Strong / Moderate / Weak} |
| Containerization | {Ready / Partial / Needs creation} |
| SDK/Language | {Supported / Partial / Unsupported} |
| Setup Effort | {Low / Medium / High} |
| Workload Effort | {Low / Medium / High} |

## Project Overview

{What the project does, primary language(s), license, notable adoption/reach.
Business criticality — why finding bugs here matters. 4-6 lines max.}

## Architecture & Suitability

{Services found and how they communicate, distributed state and replication,
claimed guarantees, failure/recovery logic, timing-sensitive operations.
Architectural fit (strong/moderate/weak) and use-case fit (strong/moderate/weak) with reasoning.}

### Candidate Properties

{2-3 rough Always/Sometimes properties for this system.
If none can be articulated, note this as a suitability concern.}

## Readiness

{What exists today that accelerates Antithesis onboarding:
- **Testing**: types found (unit/integration/e2e/chaos), frameworks, CI, testing focus. Where does Antithesis add value vs. duplicate existing coverage?
- **Containerization**: Dockerfiles, compose/k8s artifacts (with paths). Ready / Partial / Needs creation.
- **SDK**: primary language(s) vs. Antithesis supported list.
- **API surface**: documented API an external workload can drive traffic through?}

## Path to Antithesis

{What work lies ahead, what might go wrong, and the concrete next step:
- **Setup**: what needs to be created or adapted. Factors that increase or decrease effort.
- **Workload**: adapt existing tests or build from scratch? Low / Medium / High.
- **Risks**: dependency chains, k8s-only orchestration, large footprint, missing API surface, custom-only orchestration, etc.
- **Next step**: if suitable, proceed with `antithesis-research`. If limited, proceed with caveats. If not suitable, what would need to change.}

## Disqualifier Checklist

| Disqualifier | Status | Evidence |
|---|---|---|
| Single-process | {Pass / FAIL} | {one-line evidence} |
| Pure library | {Pass / FAIL} | {one-line evidence} |
| Cannot run hermetically | {Pass / FAIL} | {one-line evidence} |
| Frontend-only | {Pass / FAIL} | {one-line evidence} |
| LLM-driven core | {Pass / FAIL} | {one-line evidence} |
| Cannot target x86-64 | {Pass / FAIL} | {one-line evidence} |

```

If the verdict is **not suitable** because a disqualifier fired, keep the report short: include the Verdict (with summary table), Project Overview, a brief explanation of the disqualifier and what would need to change, and the Disqualifier Checklist. Skip the detailed Architecture, Readiness, and Path sections.

## General Guidance

- Be specific. Every claim should point to a file, directory, or pattern found in the codebase. "The project has 3 services" is not enough — "3 services: `api-server`, `worker`, `scheduler`, communicating via Redis Pub/Sub (see `docker-compose.yaml:L12-40`)" is.
- Do not over-research. This is a preflight check, not `antithesis-research`. Skim the architecture, don't trace every code path.
- A web search for the project name or company can surface business context not in the repo. Keep it brief.
- If a disqualifier applies, the verdict is **not suitable**. Do not soften it to **limited**. Reserve **limited** for projects that pass all disqualifier checks but have weak suitability signals or deployment gaps.
- If the project has an `antithesis/` directory already, note what exists — but do not treat prior Antithesis work as evidence of suitability. Run disqualifier checks regardless.
- Popularity alone does not make a project suitable. Complexity alone does not make a project suitable.

## Self-Review

Before presenting the report, verify:

- The verdict was presented to the user, not written to a file in the repo
- The verdict is one of: **suitable**, **limited**, or **not suitable**
- The summary table ratings are consistent with the detailed sections
- Every disqualifier was checked — the checklist table has no empty rows
- Suitability claims reference specific files, directories, or patterns in the codebase
- At least 2–3 candidate Always/Sometimes properties were identified (or their absence noted)
- Containerization names actual artifacts found (with paths)
- API surface accessibility was checked
- If **not suitable**: the report explains what would need to change
- If **limited**: the caveats are specific enough for the user to evaluate
- No section contains speculative claims without evidence from the codebase
