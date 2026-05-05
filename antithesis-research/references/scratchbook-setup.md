# Scratchbook Setup

## Initializing the Workspace

Create the `antithesis/` directory at the repo root (or a user-specified location) to hold all Antithesis-related configuration, code, and research artifacts.

Create the `antithesis/scratchbook/` subdirectory for the Antithesis scratchbook.

If the directory or scratchbook files already exist, preserve them and extend them instead of overwriting them.

## Provenance Frontmatter

Every top-level artifact in the scratchbook must begin with YAML frontmatter recording what the artifact describes — which SUT, at what version, on what date, and which external references were consulted. This lets future readers and downstream skills (`antithesis-setup`, `antithesis-workload`) confirm the artifact still applies to the user's current target.

```yaml
---
sut_path: <absolute path to the SUT root at time of writing>
commit: <full 40-character git SHA, or "uncommitted" if the SUT is not under git>
updated: YYYY-MM-DD
external_references:
  - path: <absolute path or URL>
    why: <one-line note on why this was consulted>
---
```

If the user said "just this directory" when asked the scope question, write `external_references: []`. The empty list means the question was asked and explicitly answered with no external references.

Downstream skills (`antithesis-setup`, `antithesis-workload`) read whatever provenance fields are present in an artifact and describe what they find. They do not enforce a rigid schema match — older artifacts with fewer fields, or no frontmatter at all, are not "broken." An artifact lacking provenance frontmatter entirely predates this convention; downstream skills handle that case by simply describing what they found.

Top-level artifacts requiring this frontmatter:

- `sut-analysis.md`
- `existing-assertions.md`
- `property-catalog.md`
- `deployment-topology.md`
- `property-relationships.md`
- `evaluation/synthesis.md`
- `evaluation/{lens}.md`

The rule applies uniformly even to artifacts whose `external_references` mirror another source. Two cases worth naming:

- `property-relationships.md` is derivative of `property-catalog.md` (same write moment, same context). Copy `external_references` from the catalog when writing it.
- `existing-assertions.md` is a fresh codebase scan written by the orchestrator inline (research SKILL.md workflow item 4), before discovery runs. There is no upstream artifact to copy from — the orchestrator writes the user's scope answer directly.

In both cases, the resulting `external_references` matches the user's answer for this run. Uniformity simplifies downstream verification — one rule, applied everywhere — at negligible cost.

Per-property evidence files (`properties/{slug}.md`) inherit context from `property-catalog.md` and do not need their own frontmatter.

When updating an existing artifact, refresh `commit` and `updated` to reflect the current codebase state. Add new entries to `external_references` if additional sources were consulted; do not remove existing entries (the artifact already reflects them).

## What the Antithesis Scratchbook Is For

The Antithesis scratchbook is the central location for durable Antithesis handoff artifacts. Use it to:

- Persist codebase-specific Antithesis analysis across conversation turns
- Share canonical inputs and outputs across `antithesis-research`, `antithesis-setup`, and `antithesis-workload`
- Record assumptions and open questions in the same files as the decisions they affect

## Writing Research Outputs

All research outputs should be written as markdown files in the Antithesis scratchbook. Use the following naming conventions:

- `antithesis/scratchbook/sut-analysis.md` — System architecture, components, data flows, and attack surfaces
- `antithesis/scratchbook/existing-assertions.md` — Scan of existing Antithesis SDK assertions in the codebase
- `antithesis/scratchbook/property-catalog.md` — Catalog of testable properties with priorities and scoring
- `antithesis/scratchbook/deployment-topology.md` — Container topology plan for the Antithesis environment
- `antithesis/scratchbook/property-relationships.md` — Suspected clusters and connections between properties
- `antithesis/scratchbook/properties/{slug}.md` — Per-property evidence files (one per cataloged property)
- `antithesis/scratchbook/evaluation/synthesis.md` — Categorized evaluation findings and actions taken
- `antithesis/scratchbook/evaluation/{lens}.md` — Per-lens evaluation evidence (antithesis-fit, coverage-balance, implementability, wildcard)

When starting from scratch, initialize each file with provenance frontmatter (see "Provenance Frontmatter" above), then a short summary section plus explicit `Assumptions` and `Open Questions` headings. This makes later iterations and handoffs easier.

Create the `antithesis/scratchbook/properties/` directory when writing the first property evidence file.

Create the `antithesis/scratchbook/evaluation/` directory when starting property evaluation.
