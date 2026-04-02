# Property Evaluation

## Goal

Stress-test the property catalog by evaluating it as a portfolio — not
individual properties in isolation, but the set as a whole. Discovery agents are
biased toward finding properties; evaluation agents are biased toward finding
problems with the catalog. Running both modes in the same stage degrades
evaluation into post-hoc rationalization of what was already found. A fresh agent
reading the catalog cold is more likely to see systematic gaps than the agent
that just built it.

This process runs after property discovery synthesis is complete and the
deployment topology exists. It produces categorized findings that either improve
the catalog directly (refinements), expand it (gap-filling), or escalate to the
human for judgment (biases).

## Prerequisites

- `antithesis/scratchbook/property-catalog.md` exists (from property discovery)
- `antithesis/scratchbook/sut-analysis.md` exists
- `antithesis/scratchbook/deployment-topology.md` exists
- `antithesis/scratchbook/existing-assertions.md` exists
- `antithesis/scratchbook/properties/` evidence files exist for cataloged properties

## Evaluation Lenses

Each lens examines the property catalog from a different angle. Findings should
be concrete and specific — not "coverage could be better" but "the SUT analysis
flags replication lag as high-risk (section X) but no property in the catalog
tests read-after-write consistency under replication delay."

### 1. Antithesis Fit

Evaluate whether each property is in Antithesis's sweet spot. Antithesis excels
at exploring state spaces that deterministic tests cannot reach:

- Timing-sensitive scenarios (race conditions, ordering dependencies)
- Concurrency-sensitive scenarios (parallel access, lock contention)
- Partial failure scenarios (network partitions, node crashes, restarts)
- Combinatorial state exploration (interleavings, fault combinations)

For each property, ask: does testing this property require exploring a state
space that deterministic tests can't cover? If the invariant can be fully
verified by a unit test with fixed inputs, it's not an Antithesis property — it's
consuming search budget that could go toward properties where fault injection
matters.

Also check the inverse: are there properties where the catalog underestimates
Antithesis's value? A property marked low-priority because "the happy path works"
might be high-value precisely because Antithesis can explore the unhappy paths
that nobody tests.

Flag:

- Properties that are really unit test or integration test territory
- Properties where the assertion type doesn't match the testing mode (e.g., a
  `Sometimes` that would need astronomically unlikely timing to trigger)
- Properties where Antithesis's value is underestimated

### 2. Coverage Balance

Evaluate the property set as a portfolio against the SUT analysis and deployment
topology. The question is not "is each property good?" but "is this the right
set?"

Read the SUT analysis section by section. For each area identified as high-risk
or failure-prone, check whether the catalog has corresponding properties. Look
for:

- Risk areas with no properties (gaps)
- Risk areas with disproportionately few properties relative to their risk level
- Low-risk areas with disproportionately many properties (over-investment)
- Missing property types — are safety, liveness, and reachability all represented
  where appropriate?
- Component blind spots — are properties distributed across the deployment
  topology or concentrated in one service?

Pay particular attention to gap patterns that property discovery commonly misses:

- Features that interact with multiple subsystems (e.g., caching + replication,
  authentication + session management, storage + garbage collection) — these
  cross-cutting concerns often fall between attention focuses
- Areas identified in bug history that didn't map cleanly to a single property
  discovery focus
- Operational scenarios (migration, upgrade, format conversion, failover) that
  span lifecycle transitions rather than steady-state behavior
- Optional or configurable features that change system behavior in ways the
  default-path analysis didn't explore

Also check for balance across assertion types. A catalog with 15 `Always`
assertions and no `Sometimes` assertions is probably missing liveness properties.
A catalog with no `Reachable` assertions may not be guiding Antithesis toward
interesting code paths.

### 3. Implementability

Evaluate whether each property can actually be checked given the deployment
topology, workload design constraints, and codebase structure.

For each property, ask:

- Can the invariant be observed from the workload, or does it require internal
  state that isn't exposed? If the latter, is the suggested SUT-side
  instrumentation feasible given the codebase?
- Does the deployment topology support the failure scenarios the property needs?
  A property about network partition behavior requires that the relevant services
  be in separate containers.
- Can the workload construct the operation sequences needed to exercise the
  property? Some properties require specific preconditions that may be
  impractical to set up reliably.
- Are there resource or timing constraints that make the property impractical?
  A property that requires sustaining high throughput for minutes may not work
  within Antithesis timeline limits.

Flag:

- Properties that can't be observed without code changes the catalog doesn't
  account for
- Properties that need a deployment topology different from what's planned
- Properties where the workload can't reliably create the necessary preconditions

### 4. Wildcard

The other 3 lenses have fixed perspectives. This lens has none. Its job is to
find what they all miss.

The orchestrator includes a one-line summary of each other lens so the wildcard
knows what territory is covered. The wildcard's job starts where theirs ends.

Directives (not principles — this lens is deliberately unconstrained):

1. **Question the framing.** The discovery agents accepted the SUT analysis and
   looked for properties within it. The other evaluation lenses accepted the
   catalog and stress-tested it within their domains. This lens can question
   whether the SUT analysis missed something that changes what properties matter.

2. **Find missing angles.** Not missing data integrity properties (Coverage
   Balance handles that) or missing observability (Implementability handles
   that) — but missing *perspectives*. A failure scenario nobody modeled. A
   usage pattern the workload can't represent. A property that only matters
   under a combination of conditions no single lens would construct.

3. **Cross-cut the lenses.** Look for issues that span multiple evaluation
   domains. A property that Antithesis Fit says is high-value but
   Implementability says is infeasible — is there a different formulation that
   captures the same risk and is feasible?

4. **Report what's odd.** If something about the catalog feels wrong but doesn't
   fit a category, report it with your best attempt at why.

## Ensemble Mode

Spawn one agent per evaluation lens, in parallel.

### Agent Instructions

Before spawning agents, create a directory for evaluation evidence files at
`antithesis/scratchbook/evaluation/`. Each agent receives:

- The full contents of `antithesis/scratchbook/property-catalog.md`
- The full contents of `antithesis/scratchbook/sut-analysis.md`
- The full contents of `antithesis/scratchbook/deployment-topology.md`
- The path to `antithesis/scratchbook/existing-assertions.md`
- The path to `antithesis/scratchbook/properties/` (evidence files directory)
- One evaluation lens (its full description from above)
- The path to write its evidence file
- These instructions:

> Evaluate the property catalog through the lens of your assigned evaluation
> focus. Read the property evidence files when you need deeper context on a
> specific property. Produce concrete, specific findings — not vague concerns.
> Write your full analysis to the evidence file path provided, then return a
> structured summary.

**Wildcard agent:** Receives the same inputs plus a one-line summary of each
other lens (e.g., "Lens 1: Antithesis Fit — evaluates whether properties are in
Antithesis's sweet spot vs. unit/integration test territory"). Does not receive
the detailed guidance for other lenses.

### Agent Output Format

Each agent produces two artifacts:

**Evidence file** (written to disk at the provided path) — full detailed
analysis: every finding with complete evidence, property excerpts, detailed
reasoning. This is the authoritative record.

**Summary** (returned to orchestrator) — a structured summary for synthesis:

**Findings** — ordered by scope (catalog-wide before property-specific). Each:

- **Property/Properties**: Which property slugs are affected, or "catalog-wide"
- **Concern**: What the problem is
- **Scope**: Catalog-wide (affects the set composition) or property-specific
- **Evidence**: Brief — full evidence is in the file
- **Suggested action**: If applicable

**Passes** — things checked that look correct. Brief.

**Uncertainties** — things the lens couldn't determine, and why.

### Synthesis and Categorization

After all agents complete, synthesize by categorizing each finding:

- **Gap**: A failure class, risk area, or property type is missing from the
  catalog. The catalog can be expanded to cover it. The gap description should
  be specific enough to serve as a targeted discovery focus.
- **Bias**: A systematic orientation problem that the evaluation agents can
  identify but not resolve — it requires human judgment about what matters most.
  Examples: the catalog is oriented toward write-path safety but the product's
  primary risk is read consistency; the property set assumes a deployment
  topology that may not match production.
- **Refinement**: A specific property needs adjustment — wrong assertion type,
  wrong priority, infeasible observation method, missing SUT instrumentation
  note. The fix is clear and can be applied directly.

Evaluation agents assess scope and describe concerns — they do not categorize
their own findings as Gap/Bias/Refinement. Categorization is the synthesis
step's responsibility. A catalog-wide finding is a strong signal toward Gap or
Bias, but the synthesizer may disagree if it sees the concern addressed by
another agent's suggestion.

Provide the paths to each agent's evidence file so the synthesizer can dig in
when needed — when scope assessments conflict, when a finding's summary is
ambiguous, or when verifying that the evidence supports the concern.

Write the synthesis results to `antithesis/scratchbook/evaluation/synthesis.md`.
Include each finding, its category, and the action to be taken.

### Addressing Findings

After categorization:

1. **Refinements**: Apply directly. Update the affected properties in the
   catalog, their evidence files, and property relationships if needed.

2. **Gaps**: Spawn targeted discovery agents to fill them. Each agent receives:
   - The gap description from evaluation (used as a targeted attention focus)
   - The SUT analysis
   - The deployment topology (gaps from the Implementability lens may need
     topology awareness to fill correctly)
   - The existing property catalog (to avoid duplicating existing properties)
   - The path to existing assertions
   - The property catalog format from `references/property-catalog.md`

   Each agent returns properties in catalog format and writes evidence files.
   Synthesize gap-fill properties into the catalog using the same
   deduplication and merge process from property discovery synthesis. Update
   property relationships with any new clusters.

3. **Biases**: Collect and present to the human with the evaluation evidence.
   Include: the bias finding, the evidence from the evaluation agent(s), and
   the specific judgment call needed. The human decides whether to accept the
   catalog as-is, redirect discovery, or adjust priorities.

After gap-filling, assess whether the additions are substantial enough to
warrant a second evaluation pass. A single gap of 1-3 properties does not need
re-evaluation. A gap that produces a new category of properties should be
re-evaluated to verify it integrates well with the existing catalog.

## Single-Agent Mode

If your environment does not support sub-agents:

1. Read all inputs: property catalog, SUT analysis, deployment topology, existing
   assertions.
2. For each evaluation lens 1-3 in order, make an explicit evaluation pass over
   the catalog. After each pass, record findings. Write the detailed analysis
   for each lens to the corresponding evaluation evidence file.
3. Run the wildcard pass (Lens 4) last. Unlike the other passes, the wildcard
   builds on awareness of what the first 3 found, looking for what they missed.
4. Categorize all findings as Gap, Bias, or Refinement.
5. Address findings: apply refinements, fill gaps by running targeted discovery
   passes, collect biases for the human.
6. Write the synthesis to `antithesis/scratchbook/evaluation/synthesis.md`.

Treat each lens pass (1-3) as a fresh examination. Resist the pull to skip a
lens because an earlier pass "already covered" it.

## Output

- `antithesis/scratchbook/evaluation/antithesis-fit.md`
- `antithesis/scratchbook/evaluation/coverage-balance.md`
- `antithesis/scratchbook/evaluation/implementability.md`
- `antithesis/scratchbook/evaluation/wildcard.md`
- `antithesis/scratchbook/evaluation/synthesis.md`
- Updated `antithesis/scratchbook/property-catalog.md` (after refinements and gap-filling)
- Updated `antithesis/scratchbook/properties/` evidence files (as needed)
- Updated `antithesis/scratchbook/property-relationships.md` (as needed)
