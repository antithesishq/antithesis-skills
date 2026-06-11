---
name: antithesis-k8s-onboarding-assistance
description: >
  Interview-driven assistant for customers with Kubernetes-based production
  setups who are getting started with Antithesis. Helps the customer (and
  the Antithesis engagement team) figure out what their k8s setup contains,
  what to keep, drop, or stub for testing, and produces structured
  questions for ops plus an escalation packet when stuck.
metadata:
  version: "2026-06-11 a68f8a9"
---

# Antithesis K8s Onboarding Assistance

## Purpose and Goal

Help customers running on Kubernetes minimize their production manifests down to a form `antithesis-setup` can use to construct an Antithesis test environment. The output is a structured analysis report — not modified YAML.

Success means:

- `antithesis/scratchbook/k8s-minimization.md` is a stable, reviewable report describing the components, dependencies, stub strategies, and decisions setup will need to construct the test environment for a k8s-based SUT
- `antithesis/scratchbook/k8s-minimization-work/working.md` captures the live decision history across passes — including reversals, defaulted decisions, and open assumptions
- The customer has either (a) finished work on this skill with the final report ready for setup, or (b) an escalation packet ready to share with their Antithesis engagement team

This skill applies only to customers running on Kubernetes. Customers using Docker Compose directly skip this skill and go straight from `antithesis-research` to `antithesis-setup`.

Note: `antithesis-setup` currently builds Docker Compose harnesses. Setup-side k8s support is a separate effort. When that effort lands, this skill's final report becomes setup's input for k8s customers; until then, the report is a structured handoff to the Antithesis engagement team rather than a direct setup input. The skill produces the same artifact regardless of which path the consumer takes downstream.

## Prerequisites and Scoping

Before this skill can do useful work, it needs scope information about what's being tested: SUT identity, test boundary, and success criteria for the app running correctly.

Two ways to get that information:

- **Read it from a prior research artifact.** Look for `antithesis/scratchbook/sut-analysis.md`. If it exists, read the SUT identity from it.
- **Interview the customer.** Ask what they're testing. Capture SUT identity, test boundary, and success criteria from the conversation.

Either source is fine. The working file records the origin so it's clear later where the scope information came from.

If neither path produces enough scope to proceed (no `sut-analysis.md`, and the customer can't articulate scope), that's a blocker — not a workflow redirect. Explain that the skill needs to know what's being tested before it can do useful work, and offer the escalation packet path so the customer can loop in their Antithesis engagement team.

This skill collects substantial additional context regardless of where the scope information came from — the customer's k8s artifacts, ops contact, sensitive-data handling preferences, success criteria detail. Scope is the gate to start; intake supplies the rest.

This skill never runs `kubectl`, `helm`, `kustomize`, `docker`, `kind`, `k3d`, or any other cluster-touching command. Customers may run commands themselves and paste the output back; the skill reads pasted output but does not execute.

## Definitions and Concepts

- **SUT:** System under test (term inherited from `antithesis-research`)
- **Horizontal minimization:** Deciding which components in the customer's manifests are part of the test scope at all (SUT, dependency, or out-of-scope)
- **Vertical minimization:** For a component that is in scope, stripping platform/cloud/observability cruft so it can run in a single-node test environment
- **Single-node test environment:** Antithesis explores timelines deterministically against a small, fixed deployment. Multi-node distributed-system features (cross-node consensus, cluster autoscaling, real load balancers, network policies enforced by a CNI) don't add value in this environment — they add state space and non-determinism. "Single-node" doesn't mean Antithesis can't test distributed-system correctness; it means the test deployment runs as one Antithesis-managed environment, with multiple replicas or services co-located rather than spread across real nodes.
- **Working file:** Live, growing artifact across passes (`antithesis/scratchbook/k8s-minimization-work/working.md`)
- **Final report:** Stable snapshot of the working file's current state, generated when handoff readiness passes (`antithesis/scratchbook/k8s-minimization.md`)
- **Landmine:** A platform-layer construct that is commonly minimized away, with a known recipe (Istio, cert-manager, external-secrets, etc.)
- **Status field:** Each entry in the working file has a status of `Confirmed`, `Defaulted`, or `Open`. Handoff readiness fails if any `Open` entries remain.

## Documentation Grounding

Use the `antithesis-documentation` skill to ground Antithesis-specific terminology.

This skill does not have its own dedicated Antithesis documentation pages — it bridges between `antithesis-research` and `antithesis-setup`. For any Antithesis-domain concept (SUT, properties, scratchbook conventions, deployment topology), defer to those skills' documentation grounding.

## Core Principles

**No archaeology.** Default direction is minimize. The bar to keep something is "we have a reason to believe the app needs this." The bar to drop is "this looks like platform/cluster concerns." Optimize for rate-of-customers-reaching-success, not correctness-on-each-decision. The two error modes are not symmetric:

- *Drop something we shouldn't*: caught at setup or runtime, recoverable in minutes.
- *Ask too many archaeology questions*: customer gives up. Unrecoverable.

Lean toward the first.

**Defaults are aggressive; the customer always overrides; every decision is visible.** Record what was decided and why in the working file. The customer can scan it and push back on any decision without justifying themselves. Reversals are first-class — when a prior decision is overturned, show the reversal explicitly in history rather than silently rewriting.

**Skill never runs cluster commands.** This is non-negotiable. Customer's machine, customer's kubeconfig, customer's cluster — the skill describes commands and reads pasted output, never executes.

**Never tell the customer "no."** When the work hits a wall — ops unresponsive, a hard architectural problem, customer is stuck — produce an escalation packet for the Antithesis engagement team. Dead ends become warm handoffs.

**Fidelity vs. speed is a calibrated tradeoff, surfaced explicitly.** When applying a landmine default that has a meaningful fidelity impact (e.g., dropping Istio when the customer tests with Istio in prod), state the fidelity cost and let the customer choose. Don't silently optimize for speed when the customer cares about fidelity.

**Keep the customer in the loop on what's about to leave their environment.** When generating the escalation packet, prompt for sensitive data review before producing the document, even if the customer already gave a sensitive-data preference at intake. Different audience, different stakes.

## Skill Flow

Eight phases. On each invocation, read the working file first to determine where you are. The working file's frontmatter records `current_phase`, so you can resume cleanly across sessions.

1. **Confirm prerequisites.** Look for `sut-analysis.md` or interview the customer for research-equivalent scope. If neither path produces enough scope to proceed, treat as a blocker and offer the escalation packet path. (See *Phase Guidance → Confirm prerequisites*.)

2. **Greeting / expectation-setting.** First-contact only. Set the frame: multi-pass, aggressive cuts, fidelity-vs-speed tradeoff, customer can override, ops-questions are the work, escalation exists. (See *Phase Guidance → Greeting*.)

3. **Intake.** Conversational with internal checklist. Cover: sensitive-data handling first, then `helm`/`kustomize` rendering if needed, then ops contact, artifact form, customer comfort level, app success criteria. (See *Phase Guidance → Intake*.)

4. **Horizontal classification.** Classify each component as SUT / dep-real / dep-stub / out-of-scope. Built from research scope + call graph from manifests. (See `references/horizontal-classification.md`.)

5. **Customer review checkpoint.** Explicit pause. Present the horizontal cut; customer pushes back. Vertical work on a misclassified component is the most expensive failure mode in this skill — do not skip the pause. (See *Phase Guidance → Customer review checkpoint*.)

6. **Vertical classification.** For each kept component, strip platform/cloud/observability cruft. (See `references/vertical-classification.md` and `references/landmines.md`.)

7. **Stub strategy.** For each stubbed dependency, describe what setup needs to fake — kind, calls made, response shapes, behaviors required, ordering constraints. (See *Phase Guidance → Stub strategy*.)

8. **Compile final report + handoff readiness check.** Roll the work into the final report only if all checklist items pass — including no `Open` status items remaining. (See *Phase Guidance → Compile and handoff*.)

The flow is multi-pass. Customer goes to ops between sessions. Skill resumes from where the working file says we are.

**Phase transitions.** When entering each phase, update `current_phase` in the working file's frontmatter to the phase number you're entering. The reference files for phases 4 and 6 also call out specific phase advancement points; otherwise the rule is straightforward — `current_phase` always reflects the phase the skill is currently in or about to begin on resumption. Phases 1 and 2 typically run only on first contact and don't get re-entered; the working file is created in phase 1 with `current_phase: 1` and advances forward from there.

**`pass_count` and `last_pass` semantics.** A "pass" is a customer-ops round-trip. Increment `pass_count` and update `last_pass` to today's date when:
- Generating a fresh `ops-questions.md` after the customer returns with answers from ops
- The customer arrives with new manifest content (rendered Helm output, additional files) that triggers re-classification
- The customer requests a new pass explicitly

Multiple skill invocations within a single customer-ops round-trip don't count as separate passes. The `pass_count` is what's reflected in the `Pass <N>` header of `ops-questions.md`.

## Phase Guidance

### Confirm prerequisites

This phase runs only on first invocation; subsequent invocations resume from whatever phase the working file's `current_phase` indicates and skip this section.

**Locate the scratchbook.** `antithesis/scratchbook/` lives at the root of the customer's project repository (the directory the skill is invoked in). It's a shared convention across the Antithesis skill family (see `antithesis-research/references/scratchbook-setup.md`). If `antithesis/scratchbook/` doesn't exist, create it. Then create `antithesis/scratchbook/k8s-minimization-work/` for this skill's working artifacts.

**Get scope information.** Read `antithesis/scratchbook/sut-analysis.md` if it exists — that's the standard source. If it doesn't exist, ask the customer: "what specifically are you testing — a single service, a flow across services, a database, an end-to-end customer journey?" Capture SUT identity, test boundary, and success criteria from whichever source produces them.

**If scope can't be established at all** — no `sut-analysis.md`, and the customer can't articulate scope — that's a blocker, not a workflow redirect. Explain we need scope information before the skill can do useful work, and offer the escalation packet path so the customer can loop in their Antithesis engagement team.

**Create the working file.** Initialize `antithesis/scratchbook/k8s-minimization-work/working.md`. Populate the *Application overview* section with the SUT identity, test boundary, success criteria, and the *origin* of these (whether `sut-analysis.md` or interview).

### Greeting

First contact only. Use these beats:

- This will take multiple passes. That's normal, not a failure mode.
- We build artifacts under `antithesis/scratchbook/k8s-minimization-work/` that persist between sessions, plus a final report when we're done.
- Each pass usually ends with you having questions to take to ops; that's the work.
- I'll be aggressive about cutting Kubernetes platform machinery — service mesh, monitoring, autoscaling, secret operators, and similar. Sometimes I'll cut something the app actually needs; we add it back if it surfaces. Speed-to-running over perfect-on-first-try.
- This skill stops at the final report. The next step is `antithesis-setup`, where the test environment actually gets constructed; minimization done is not the same as ready to run.
- If we hit something we can't resolve, we produce a packet you can hand to your Antithesis engagement team — you're not stuck, you're escalating with context.

End with: "have you done this kind of minimization before, or is this your first time?" — calibrates how much hand-holding to do without making it feel like a quiz.

**Advance to phase 3** (intake) when the customer has acknowledged the framing and answered the calibration question.

### Intake

Conversational with internal checklist. Scan the working directory first for k8s-shaped artifacts (`*.yaml` manifests, `Chart.yaml`, `kustomization.yaml`, ArgoCD `Application` files); use what you find to scope the questions. A 20-question intake form will lose people; ask only what you can't infer.

Top-level steps:

1. **Sensitive-data handling.** Before the customer pastes anything, ask: "manifests often contain things you might not want in this conversation — internal hostnames, embedded secrets, account IDs, customer-private domain names. Do any of those apply, and if so how do you want to handle them: redact in place, mask, or share as-is?" Capture the answer in the working file's metadata. Respect the preference for the rest of the engagement, and re-prompt at any later point where new content might be sensitive (escalation packet generation, ops-questions documents that quote manifests).

2. **Render Helm / Kustomize if needed.** If the customer brought templates rather than rendered output, walk them through running `helm template` (with their prod values) or `kustomize build` and pasting the result back. Templates by themselves are not analyzable — values determine what's actually deployed.

3. **Internal checklist** — establish each of these, conversationally:
   - Customer name, role, ops contact, preferred channel for ops to respond
   - What artifacts they have (Helm chart? Kustomize? raw manifests? a fragment? nothing yet?)
   - Whether this represents the prod form or a simplified one
   - Cloud/platform layer they're on (best-effort; "I don't know" is acceptable)
   - Customer's k8s comfort level
   - App success criteria — what running correctly looks like

The success criteria question is the easiest to skip and the most expensive to skip. Establish it during intake; otherwise handoff readiness will hit "no idea what running-correctly means."

### Customer review checkpoint

After horizontal classification, stop. Present the cut — SUT, dep-real, dep-stub, out-of-scope — with one-line reasoning per component. Format so the customer can identify obvious misclassifications without pausing to look things up.

Common pushback shapes:

- "X is in scope because it does Y you didn't see"
- "Y should be stubbed not real because Z"
- "Z isn't really used, drop it"

Each correction updates the working file with a reversal entry visible in history. Log a history entry when the customer either confirms the cut or applies corrections — that history entry is what the Self-Review checks.

**Advance to phase 6** (vertical classification) when the customer has confirmed the cut or all corrections have been applied. Set `current_phase: 6` in the working file's frontmatter.

### Stub strategy

For each dependency classified as `Dependency-stub` during horizontal classification, write a *Stub specifications* entry in the working file describing what setup needs to construct. The skill produces descriptions; setup builds the actual stub. Each entry covers:

- **Kind** — what kind of dependency (HTTP service, gRPC service, message queue, database, cloud API, etc.)
- **Calls the SUT makes against it** — which endpoints, methods, or queue topics; what calls happen during the test flow
- **Expected response shapes** — what canned responses the stub returns; specific fields the SUT reads
- **Behaviors required by the test** — success path, specific failure modes, latency characteristics, sequencing
- **Ordering / sequencing constraints** — if the test depends on a specific order of calls, or on the stub remembering state across calls

Example:

```markdown
### auth-service (HTTP stub)

**Kind**: External HTTP service
**Status**: Confirmed

**Calls SUT makes**:
- `POST /token` (during login flow)
- `GET /verify?token=<...>` (during request authentication)

**Response shapes**:
- `POST /token` → `200 OK` with `{"access_token": "<test-jwt>", "expires_in": 3600}`
- `GET /verify` → `200 OK` with `{"valid": true, "user_id": "<id-from-request>"}` for tokens issued by this stub; `401` for unknown tokens

**Behaviors required**:
- Stable token issuance — same input produces same token within a test run
- Failure path: stub should return `401` for verification of an unrecognized token (the test exercises invalid-token handling)

**Ordering / sequencing constraints**: None — each request is independent.
```

The descriptions are concrete enough for setup to build a stub without needing to re-derive what the SUT expects. They do not prescribe *how* the stub is implemented (Python, Go, mock framework, etc.) — that's setup's call.

**Advance to phase 8** (compile and handoff) when every entry in the *Stub specifications* section has a status of `Confirmed` or `Defaulted` (no `Open`) and every dep-stub from horizontal classification has a corresponding stub spec. Set `current_phase: 8` in the working file's frontmatter.

### Compile and handoff

When `current_phase` is `8`, run the handoff readiness check (see *Working File and Final Report Structure → Handoff readiness checklist*). If it passes, write the final report at `antithesis/scratchbook/k8s-minimization.md` as a snapshot of the working file's *Current state* sections. If it fails, list the gaps to the customer and continue iterating — fixes may require revisiting earlier phases (set `current_phase` back to whichever phase the gap belongs to).

There is no separate customer review checkpoint at compile time. The customer can scan the working file at any pass and push back on any decision; pushback updates the working file with a reversal entry. This is by design — adding a second mandatory checkpoint at compile would slow the loop without proportional benefit, since `Defaulted` decisions are recoverable later when setup runs and behavior is observed. The horizontal review checkpoint (Phase 5) is the only mandatory pause, because horizontal mistakes are the most expensive (vertical work on a misclassified component is wasted effort).

## Working File and Final Report Structure

### Working file: `antithesis/scratchbook/k8s-minimization-work/working.md`

Frontmatter:

```yaml
---
current_phase: <integer 1-8 matching the phase the skill should resume in>
sensitive_data_preference: <"redact-in-place" | "mask" | "share-as-is" | "not-yet-asked">
started: <YYYY-MM-DD>
last_pass: <YYYY-MM-DD>
pass_count: <integer>
---
```

Initial values when the working file is created in phase 1: `current_phase: 1`, `sensitive_data_preference: not-yet-asked`, `started` and `last_pass` both set to today's date, `pass_count: 0`. The first regeneration of `ops-questions.md` after intake increments `pass_count` to 1 (see *Skill Flow → pass_count and last_pass semantics* for what counts as a pass).

Body — *Current state* sections:

1. **Header / metadata** — customer info, contact, app name, ops contact, handoff readiness checklist (see below)
2. **Application overview** — what the app is, what it does, success criteria, SUT identity, test boundary, and *origin* of these (research's `sut-analysis.md` or research-equivalent input from intake)
3. **Horizontal classification** — SUT, dep-real, dep-stub, out-of-scope, with the inferred call graph and any remaining call-graph open questions. Reverse-dependencies captured *descriptively* (what triggers SUT in prod), not prescriptively. Decisions about test driver design belong to `antithesis-workload`.
4. **Component inventory** — for each kept component (SUT or dep-real): image + pull info, replicas, env vars and their sources, volume mounts, kept sidecars, dependencies in/out, decisions applied
5. **Stub specifications** — for each stubbed dependency, what setup needs to fake
6. **External dependencies (non-stubbed)** — anything outside the cluster the test environment must account for
7. **Open assumptions** — things defaulted on without confirmation; setup needs to know in case behavior is wrong

Each entry has a status:

- `Confirmed` — known from manifests + customer + ops
- `Defaulted` — default applied, not yet challenged
- `Open` — waiting on ops or customer

Body — *History* section: pass-by-pass log. Short entries: what changed in current state, what answers came in, which decisions were reversed and why.

### Final report: `antithesis/scratchbook/k8s-minimization.md`

Generated only when handoff readiness passes. A snapshot of the working file's *Current state* sections (no history, no `Open` items, no live frontmatter beyond a snapshot date). Once setup's k8s support lands, `antithesis-setup` will read this file directly; until then, it is the structured handoff packet the customer shares with their Antithesis engagement team.

If a downstream issue (setup, engagement-team feedback, customer-side discovery) prompts re-entry to this skill and changes are made, regenerate the final report on the next handoff readiness pass — overwriting the prior snapshot. Working file history preserves the audit trail across regenerations.

### Handoff readiness checklist

The skill compiles the final report only when all of these are true:

- All workloads identified
- Dependencies catalogued (with stub/real classification)
- Major decisions settled or noted as open assumptions
- Success criteria captured
- No unexplained platform leftovers in described components
- No items with `Open` status remaining (only `Confirmed` and `Defaulted` allowed)

If any item fails, do not write the final report. List the gaps explicitly to the customer and continue iterating.

## Ops-Questions Format

File: `antithesis/scratchbook/k8s-minimization-work/ops-questions.md`. One file at a time, current-pass-only. Resolved questions move to the working file's history; do not let `ops-questions.md` accumulate across passes.

Optimize for: ops engineer opens the doc, replies in 5 minutes, doesn't need a meeting.

Structure:

```markdown
# Ops Questions — <project name> — Pass <N>

[Brief intro context — use this template, filling in <customer-side-engineer> and
 <project name>:

  > <customer-side-engineer> here. We're working with Antithesis, a deterministic
  > testing service that runs our application against a wide range of fault scenarios
  > and timing conditions to find bugs we'd otherwise miss. To run our system in
  > Antithesis, we need to minimize our production Kubernetes setup down to a
  > self-contained test environment, and that needs answers to the questions below.
  >
  > Reply by editing this doc inline or pasting into Slack. The worst case is we
  > make a wrong call and the test setup fails to start — we can fix iteratively.
  > Your answer doesn't have to be perfect.

If the customer wants to phrase it differently, that's fine — the requirements are:
two sentences explaining Antithesis, the reply mechanism, and the "answer doesn't
have to be perfect" framing.]

## Quick context

- What ingress controller do we use? (nginx / traefik / aws-alb / other / none)
- What's the storage class for PVCs in <namespace>? (default / specific / none)
- Are there mutating admission webhooks active? (yes / no / don't know)
[etc. — one-line factual questions ops can answer fast]

## Blocking — we can't proceed without these (or an explicit "don't know")

### Q1: <Specific, scannable title>

**Where**: <file path or kubectl reference>

**Why we're asking**: <one sentence — what decision this affects>

**Pick one**:
- [ ] <Answer A> → we [action] and proceed
- [ ] <Answer B> → we [different action]
- [ ] Don't know → we [default action] and customer team can flag if it breaks verification

[etc.]

## Confirming assumptions

### A1: <Title>

**Assumption**: <what we're assuming and why>

**Push back if**: <what would invalidate the assumption>

[etc.]

## Nice-to-know

- <one-liner>
- <one-liner>
```

The "don't know → default action" option is mandatory on every blocking question. Without it, unanswered questions block forever; with it, the worst case is a fixable wrong call.

**The filter on what to ask.** Only ask if the answer changes a decision. If the skill is going to default-drop regardless, do not ask. Every question is a tax on the customer-ops relationship.

**Partial-answer handling.** When ops answers some questions but not others on a round-trip, move the answered questions' substance to the working file's history (capture the answer), then regenerate `ops-questions.md` containing only the still-unanswered questions plus any new ones raised by the answers received. The working file's history is the canonical record of which questions have been answered when.

**Sensitive-data handling.** The intake-time preference (recorded in the working file's frontmatter as `sensitive_data_preference`) governs how `ops-questions.md` content is shaped. When generating questions that quote manifest content, apply the preference: redact in place (replace identifiers with placeholders), mask (use generic names like `<service-name>`), or share as-is. Do not re-prompt the customer at every regeneration — the intake preference is for this audience (the customer's own ops team), and re-prompting becomes friction. Re-prompting only matters when the audience changes (escalation packet → Antithesis engagement team), where the *Sanitization checkpoint* in the escalation section applies.

## Escalation Packet Template

File: `antithesis/scratchbook/k8s-minimization-work/escalation.md`. Generated on demand.

Two triggers:

- Customer asks ("I want to loop in our Antithesis rep")
- Skill proactively *suggests* (does not auto-generate) when stalling — multiple passes without forward progress, ops unresponsive on blocking questions, customer expressing frustration

Two flavors, same structure:

- **Stalling** — technical work could continue but the human/process side is stuck
- **Hard problem** — minimization itself has hit something needing Antithesis-side expertise

Structure:

```markdown
# Antithesis Escalation Packet — <customer> — <YYYY-MM-DD>

## Context
- Customer: <name, contact>
- App under test: <brief>
- Cluster environment: <cloud/platform>
- Customer-side engineer: <name, role>
- Antithesis engagement contact (if known): <name>

## Status
- Currently on pass <N>
- Started: <YYYY-MM-DD>
- Most recent activity: <YYYY-MM-DD, what>

## Why we're escalating
<One paragraph. Specific. Not "we're stuck."
Example: "Three passes in; ops unresponsive on four blocking Istio AuthZ
questions; customer engineer unable to get internal traction.">

## Decisions so far
<Compact summary of the working file's consequential calls.>

## What's open
<Compact view of ops-questions.md, with how long each has been outstanding.>

## What we've tried
<For hard-problem escalations specifically. Otherwise omit.>

## Suggested next steps
<Skill's best guess at what would unstick this. Be honest about confidence — if
 the skill genuinely doesn't know, say so. "We've exhausted what we can do
 without ops input" is a valid suggestion.>

## Artifacts
- working.md
- ops-questions.md
- (final report not yet generated; or path if it exists)
```

**Attaching artifacts.** The packet itself is a single markdown document; the customer should attach the entire `antithesis/scratchbook/k8s-minimization-work/` directory when sending so the engagement team can read the working file directly. Mention this to the customer when generating the packet — don't bake the instruction into the packet body.

**Sanitization checkpoint.** A second sensitive-data prompt (the first is at intake). Even if the customer chose "share as-is" at intake, ask again — different audience (Antithesis engagement team), different stakes. Also scan the packet for obvious patterns (internal hostnames, IP ranges, cloud account IDs, ARNs, embedded credentials, customer-private domains) and prompt the customer to review the whole bundle. Offer to produce a sanitized copy if requested. Customer makes the final call on what gets sent.

**Tone.** Skill writes in its own voice; customer reviews and edits before sending. Neutral and factual, not a complaint. "Here's where we are, here's what's blocking, here's how the rep can help." Should be comfortable to forward without rewriting.

**Snapshot, not evolving.** Each escalation is point-in-time. If escalation is needed again later, generate a fresh one — don't try to maintain a single living escalation document.

## Reference Files

| Reference | When to read |
| --- | --- |
| `references/horizontal-classification.md` | Phase 4 — before classifying components into SUT / dep-real / dep-stub / out-of-scope |
| `references/vertical-classification.md` | Phase 6 — before stripping platform/cloud cruft from kept components |
| `references/landmines.md` | Phase 6, alongside vertical-classification — for the curated list of common platform constructs and how to handle them; also referenced from horizontal-classification for the *Operators and their products* edge case |
| `references/operator-recipes.md` | Phase 6, when an operator-replacement decision arises (postgres-operator → primitives, etc.) |

## General Guidance

- The customer's manifests stay where they are. Do not modify or rewrite YAML.
- Read the working file at the start of every invocation. It is the single source of truth for resumption.
- Record decisions as they're made, not at the end of a phase. The working file is also the audit trail.
- When defaulting a decision (no explicit customer or ops input), mark its status as `Defaulted`, not `Confirmed`. The status field is what the handoff readiness check reads.
- When a customer pushes back on a decision, log the reversal explicitly in the history section. Do not silently rewrite past decisions.
- Reverse-dependencies (cron jobs, external callers) are captured *descriptively* in the working file ("in prod, X triggers SUT with Y"). The decision about what test drivers exist belongs to `antithesis-workload`. Do not write "test driver needed."
- Operator-replacement is a horizontal/vertical boundary case. Drop the operator (vertical) but the thing it produces gets its own component entry (horizontal). See `references/operator-recipes.md`.

## Output

- `antithesis/scratchbook/k8s-minimization-work/working.md` (live across passes)
- `antithesis/scratchbook/k8s-minimization-work/ops-questions.md` (current pass only, regenerated each pass)
- `antithesis/scratchbook/k8s-minimization-work/escalation.md` (on demand only)
- `antithesis/scratchbook/k8s-minimization.md` (generated when handoff readiness passes; once setup's k8s support lands, consumed by `antithesis-setup`; until then, the structured handoff packet for the Antithesis engagement team)

## Self-Review

Before declaring this skill complete (writing the final report), review the working file against the criteria below. If your agent supports spawning sub-agents, create a new agent with fresh context to perform this review — give it the path to this skill file and to the working file. A fresh-context reviewer catches blind spots that in-context review misses. If your agent does not support sub-agents, perform the review yourself: re-read the success criteria at the top of this file, then check each criterion below against the working file.

Review criteria:

- The working file's *Application overview* section captures SUT identity, test boundary, success criteria, and the origin (research's `sut-analysis.md` or research-equivalent intake input)
- Sensitive-data handling preference is recorded in frontmatter (not `not-yet-asked`)
- Every component visible in the customer's manifests is classified — SUT, dep-real, dep-stub, or out-of-scope — with one-line reasoning
- The customer reviewed and approved the horizontal classification before vertical work began (the working file's history section contains an entry recording the customer's confirmation or corrections, dated)
- Every kept component (SUT or dep-real) has a Component inventory entry covering image, replicas, env vars, mounts, kept sidecars, in/out dependencies
- Every stubbed dependency has a Stub specifications entry describing what setup needs to fake
- Every `Defaulted` entry has a one-line rationale explaining the default chosen
- Reverse-dependencies are captured descriptively, not prescriptively — no "test driver needed" language
- Open assumptions are recorded explicitly, with status `Defaulted` or `Open` — not silently elided
- No `Open` status items remain in the working file
- Sensitive-data handling preference was applied to any manifest content quoted in `ops-questions.md` (per the preference recorded in frontmatter)
- The final report `antithesis/scratchbook/k8s-minimization.md` was written only after handoff readiness passed — it is a snapshot, not a copy of the live working file
- The final report contains no history section, no live frontmatter beyond a snapshot date, and no `Open` status items (since no `Open` items existed in the working file at the time of snapshot)
- If escalation was generated, sanitization checkpoints (intake-time and escalation-time) are visible in the working file's history
- The skill never ran cluster commands; all command execution was the customer's responsibility
