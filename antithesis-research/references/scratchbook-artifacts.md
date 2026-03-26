# Scratchbook Artifacts

This document defines the artifact format contract for the Antithesis scratchbook. Skills that produce or consume scratchbook artifacts should reference this document to ensure consistency.

## Artifact Set

The scratchbook lives at `antithesis/scratchbook/` in the target repository and contains:

| Artifact | Producer | Consumers | Purpose |
|---|---|---|---|
| `sut-analysis.md` | research | setup, workload | System architecture, components, data flows, failure-prone areas |
| `deployment-topology.md` | research | setup | Minimal container topology for the Antithesis environment |
| `property-catalog.md` | research | workload, refinement (future) | Concise, scannable catalog of testable properties with priorities |
| `property-relationships.md` | research | refinement (future) | Suspected clusters and connections between properties |
| `properties/{slug}.md` | research | refinement (future) | Per-property evidence trail and context |

## Layout

```
antithesis/scratchbook/
  sut-analysis.md
  deployment-topology.md
  property-catalog.md
  property-relationships.md
  properties/
    {slug}.md
    {slug}.md
    ...
```

## Property IDs

Each property has a unique identifier called a **slug**. Slugs are descriptive, kebab-case strings (e.g., `acked-writes-survive`, `no-split-brain`, `leader-election-completes`).

The slug is the canonical identifier for a property. It is used consistently as:

- The identifier in the property catalog heading (`### acked-writes-survive — Acknowledged Writes Survive`)
- The filename for the property's evidence file (`properties/acked-writes-survive.md`)
- The reference in the property relationships file

This consistency means a slug uniquely identifies a property across all artifacts. There is no separate numeric ID.

## Property Catalog

The property catalog (`property-catalog.md`) is the human-readable summary of all discovered properties. It is designed for scanning and prioritization.

The catalog carries YAML frontmatter that records provenance — the git commit and date of the codebase it was analyzed against. See `references/property-catalog.md` for the frontmatter format and the full catalog specification.

Each property's evidence file lives at `properties/{slug}.md`, where the slug matches the property's heading in the catalog.

## Per-Property Evidence Files

Each property in the catalog has a corresponding evidence file at `properties/{slug}.md`. These files capture the context and reasoning behind the property — information that would otherwise be lost when research compresses its findings into the catalog.

Evidence files are freeform markdown. There is no required structure. Typical content includes:

- **Evidence trail** — what led to identifying this property (code patterns, bug history, claimed guarantees, documentation)
- **Relevant code paths** — specific files and functions involved
- **Failure scenario** — what goes wrong if this property is violated
- **Key observations** — anything expensive to rediscover (timing windows, configuration dependencies, subtle interactions)

The purpose is to preserve what the research skill already knows so that downstream skills don't have to rediscover it.

## Property Relationships

The property relationships file (`property-relationships.md`) groups properties into suspected clusters based on shared evidence, code paths, or failure mechanisms. It also notes suspected dominance relationships (where one property likely implies another).

This file is lightweight — research flags connections it noticed during discovery without doing deep analysis. Confirming or rejecting these relationships is the job of a future refinement skill.

### Format

```markdown
# Property Relationships

## [Cluster Name]
Properties: slug-a, slug-b, slug-c
Notes: Brief explanation of why these properties are related.
Any suspected dominance or dependency relationships.

## [Cluster Name]
Properties: slug-d, slug-e
Notes: ...
```

### What to Capture

- Properties that share the same underlying code path or failure mechanism
- Properties where one likely implies another (suspected dominance)
- Properties that represent different facets of the same system behavior (e.g., safety and liveness sides of the same protocol)
- Properties with causal dependencies (A is a precondition for B)

### What Not to Capture

- Properties that are merely in the same category (e.g., both are "data integrity" properties) but don't share evidence or code paths
- Deep analysis of whether dominance actually holds — that requires deeper investigation than research provides
