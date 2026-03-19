# Scratchbook Setup

## Initializing the Workspace

Create the `antithesis/` directory at the repo root (or a user-specified location) to hold all Antithesis-related configuration, code, and research artifacts.

Create the `antithesis/scratchbook/` subdirectory for the Antithesis scratchbook.

If the directory or scratchbook files already exist, preserve them and extend them instead of overwriting them.

## What the Antithesis Scratchbook Is For

The Antithesis scratchbook is the central location for durable Antithesis handoff artifacts. Use it to:

- Persist codebase-specific Antithesis analysis across conversation turns
- Share canonical inputs and outputs across `antithesis-research`, `antithesis-setup`, and `antithesis-workload`
- Record assumptions and open questions in the same files as the decisions they affect

## Writing Research Outputs

All research outputs should be written as markdown files in the Antithesis scratchbook. Use the following naming conventions:

- `antithesis/scratchbook/sut-analysis.md` — System architecture, components, data flows, and attack surfaces
- `antithesis/scratchbook/property-catalog.md` — Catalog of testable properties with priorities and scoring
- `antithesis/scratchbook/deployment-topology.md` — Container topology plan for the Antithesis environment

When starting from scratch, initialize each file with a short summary section plus explicit `Assumptions` and `Open Questions` headings. This makes later iterations and handoffs easier.
