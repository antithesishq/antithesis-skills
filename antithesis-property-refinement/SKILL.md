---
name: antithesis-property-refinement
description: >
  Refine selected properties from the research skill's output: resolve open
  questions, confirm or reject dominance relationships, and produce structured
  property definitions ready for the workload skill.
keywords:
  - antithesis
  - properties
  - refinement
  - specification
  - dominance
---

# Antithesis Property Refinement

## Purpose and Goal

Take a set of properties selected by the user from the research skill's output and refine them into structured property definitions that the workload skill can implement from without guesswork. Success means:

- Every open question in the selected properties' evidence files has been investigated and resolved
- Dominance relationships between selected properties have been confirmed or rejected with evidence
- Each surviving property has a structured definition that captures observability bindings, temporal structure, scope, and placement
- Properties that were found to be dominated during refinement are marked as such in the property catalog with a reference to the dominating property

## Prerequisites

The following research artifacts must exist:

- `antithesis/scratchbook/property-catalog.md` — the property catalog with slug-based IDs
- `antithesis/scratchbook/properties/{slug}.md` — evidence files for the selected properties
- `antithesis/scratchbook/property-relationships.md` — suspected clusters and connections

The user must provide a set of property slugs or a cluster to refine. If the user names a cluster from the relationship map, use all properties in that cluster.

## Definitions and Concepts

- **Dominance:** Property A dominates property B if testing A inherently covers B. If A is violated, B is necessarily also violated. Confirming dominance requires examining the actual code paths, not just the descriptions.
- **Open question:** A question flagged in an evidence file that research could not answer within the scope of discovery. The evidence file should explain why the question matters and what the answer changes.
- **Structured property definition:** The refinement output format that captures everything the workload skill needs to implement assertions. Format defined in `references/structured-definition.md`.

## Documentation Grounding

Use the `antithesis-documentation` skill to ground Antithesis-specific terminology and implementation advice.

- Properties and assertions: `https://antithesis.com/docs/properties_assertions/assertions.md`
- Sometimes assertions: `https://antithesis.com/docs/best_practices/sometimes_assertions/`
- Define test properties: `https://antithesis.com/docs/using_antithesis/sdk/define_test_properties/`

## Reference Files

| Reference | When to read |
| --- | --- |
| `references/structured-definition.md` | Always — defines the output format for refined properties |
| `references/investigation.md` | When resolving open questions from evidence files |
| `references/dominance.md` | When confirming or rejecting dominance relationships |

## Workflow

### 1. Load context

Read the property catalog, the relationship map, and the evidence files for all selected properties. If properties in the selection appear in relationship clusters with properties outside the selection, read those neighboring evidence files too — they provide context for dominance analysis.

### 2. Investigate open questions

Follow `references/investigation.md`. Spawn one agent per property that has open questions, in parallel. Properties without open questions skip this step. After all agents return, write the updated evidence files to the scratchbook. If any property was invalidated by investigation, mark it as such in the property catalog with the reason and do not process it further.

### 3. Resolve dominance

Follow `references/dominance.md`. Use a single agent for all dominance resolution in the selected set — dominance is a graph problem that requires seeing all pairs together. After the agent returns, update the relationship map, evidence files, and catalog accordingly. Dominated properties are marked in the catalog, not deleted.

### 4. Produce structured definitions

For each property that survived investigation and dominance analysis, produce a structured property definition. See `references/structured-definition.md` for the format.

Write structured definitions to `antithesis/scratchbook/refined/{slug}.md`.

### 5. Update artifacts

- Update evidence files with investigation findings (already done in step 2)
- Update the relationship map with confirmed/rejected dominance findings
- Update the property catalog to mark refined properties and mark any that were invalidated or dominated

## Output

- `antithesis/scratchbook/refined/{slug}.md` — structured property definitions (one per surviving property)
- Updated `antithesis/scratchbook/properties/{slug}.md` — evidence files with resolved questions
- Updated `antithesis/scratchbook/property-relationships.md` — confirmed/rejected dominance
- Updated `antithesis/scratchbook/property-catalog.md` — refined, invalidated, and dominated status marked

## Self-Review

Before declaring this skill complete, review your work against the criteria below. If your agent supports spawning sub-agents, create a new agent with fresh context to perform this review — give it the path to this skill file and have it read all output artifacts. A fresh-context reviewer catches blind spots that in-context review misses. If your agent does not support sub-agents, perform the review yourself.

Review criteria:

- Every open question in the selected properties' evidence files has been investigated and answered with code evidence
- Evidence files have been updated with investigation findings — no stale questions remain for refined properties
- Dominance relationships have been confirmed or rejected with specific code path evidence, not just description-level reasoning
- Every surviving property has a structured definition in `antithesis/scratchbook/refined/`
- Invalidated and dominated properties are marked in the catalog with clear reasoning and references
- The relationship map reflects confirmed/rejected dominance findings
- Structured definitions are concrete enough for the workload skill to implement without guesswork
