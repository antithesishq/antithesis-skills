---
name: antithesis-research
description: >
  Analyze a codebase to figure out how it should be tested with Antithesis:
  map the system, identify failure-prone areas and testable properties, and
  produce the research artifacts needed for workload and environment planning.
keywords:
  - antithesis
  - properties
  - safety
  - liveness
  - correctness
  - research
  - planning
---

# Antithesis Research

## Purpose and Goal

Research a target system and produce scratchbook artifacts that unblock the rest of the workflow. Success means:

- `antithesis/scratchbook/sut-analysis.md` captures architecture, state, concurrency, and failure-prone areas
- `antithesis/scratchbook/property-catalog.md` lists concrete, testable properties with priorities
- `antithesis/scratchbook/deployment-topology.md` describes the minimal useful container topology

## Prerequisites and Scoping

Start from the repo, checked-in docs, and existing scratchbook files first. Ask the user only for blockers or scoping decisions you cannot infer safely, such as:
- The repo or codebase location, if it is not already clear
- Which subsystem or component matters most, if the work is narrower than the whole repo
- Known incidents, closed bugs, or specific failure modes worth targeting
- External documentation, issue trackers, or design docs not present in the repo

If scratchbook artifacts already exist, treat them as inputs and extend them instead of rewriting them unless the user asks for a fresh pass.

## Definitions and Concepts

- **SUT:** System under test.
- **Workload:** A synthetic workload designed to exercise the target system
- **Safety property (correctness):** A bad thing never happens
- **Liveness property (progress):** A good thing eventually happens
- **Reachability property:** A code path or behavior is reachable or unreachable
- **Test Template:** A directory of Test Commands located at `/opt/antithesis/test/v1/{name}/`. There may be more than one test template. Each timeline executes commands from a single Test Template. Files or subdirectories prefixed with `helper_` are ignored by Test Composer.
- **Test Command:** An executable file in a Test Template with a valid prefix. Valid prefixes: `parallel_driver_`, `singleton_driver_`, `serial_driver_`, `first_`, `eventually_`, `finally_`, `anytime_`
- **Timeline:** A single linear execution of the target system and workload. Antithesis runs many timelines in parallel and branches them to search for interesting behaviors.

## Documentation Grounding

Use the `antithesis-documentation` skill to ground Antithesis-specific terminology and implementation advice.

- Properties and assertions: `https://antithesis.com/docs/properties_assertions/assertions.md`
- Sometimes assertions: `https://antithesis.com/docs/best_practices/sometimes_assertions/`
- Define test properties: `https://antithesis.com/docs/using_antithesis/sdk/define_test_properties/`
- SDK runtime modes and production behavior: `https://antithesis.com/docs/using_antithesis/sdk/`
- Optimize for testing: `https://antithesis.com/docs/best_practices/optimizing.md`

## Reference Files

| Reference                           | When to read                                        |
| ----------------------------------- | --------------------------------------------------- |
| `references/scratchbook-setup.md`      | Always — read first to initialize the workspace     |
| `references/sut-analysis.md`        | Analyzing the codebase and understanding components |
| `references/property-discovery.md`  | Discovering properties through structured attention focuses |
| `references/property-catalog.md`    | Format and methodology for documenting properties   |
| `references/deployment-topology.md` | Designing the container topology for Antithesis     |

## Recommended Workflows

### Full research pass (new project)

1. Read `references/scratchbook-setup.md`
2. Read `references/sut-analysis.md`
3. Read `references/property-discovery.md` and `references/property-catalog.md`
4. Discover properties using the ensemble or single-agent workflow from `references/property-discovery.md`
5. Read `references/deployment-topology.md`
6. Write or update all findings in the scratchbook under `antithesis/scratchbook/`

### Targeted property research

1. Read `references/sut-analysis.md` if the system model is missing or stale
2. Read `references/property-discovery.md` and `references/property-catalog.md`
3. Discover properties using the ensemble or single-agent workflow from `references/property-discovery.md`
4. Turn claimed guarantees, incidents, and bug reports into explicit properties, and choose the Antithesis assertion type that matches each one
5. Update `antithesis/scratchbook/property-catalog.md` and record assumptions or open questions

### Property expansion (after triage)

1. Read `references/property-discovery.md` and `references/property-catalog.md`
2. Review triage findings from the `antithesis-triage` skill
3. Use the attention focuses from `references/property-discovery.md` to look for new properties inspired by triage findings
4. Update the relevant files in the scratchbook

## General Guidance

- Prefer specific, checkable guarantees over vague goals like "test failover"
- If the system claims a guarantee in docs, comments, or issues, try to make it a property
- Record not just the invariant, but why the chosen Antithesis assertion type is the right semantic fit for that property
- Use `Sometimes` for liveness or meaningful-state reachability, not for invariants that must hold on every evaluation
- Remember that Antithesis SDK assertions do not crash the program on failure; they are intended to be safe in production code and usually become low-overhead fallbacks or no-ops outside Antithesis
- Focus on timing-sensitive, concurrency-sensitive, and partial-failure scenarios where Antithesis is strongest
- Keep the deployment topology minimal; every extra container expands state space
- Write down assumptions and open questions in the scratchbook instead of keeping them implicit
- If only part of the research is requested, still update the relevant scratchbook files and note what remains undone

## Output

- `antithesis/scratchbook/sut-analysis.md`
- `antithesis/scratchbook/property-catalog.md`
- `antithesis/scratchbook/deployment-topology.md`

These outputs should be concrete enough for the `antithesis-setup` skill and the `antithesis-workload` skill to use directly.

## Self-Review

Before declaring this skill complete, review your work against the criteria below. If your agent supports spawning sub-agents, create a new agent with fresh context to perform this review — give it the path to this skill file and have it read all output artifacts. A fresh-context reviewer catches blind spots that in-context review misses. If your agent does not support sub-agents, perform the review yourself: re-read the success criteria at the top of this file, then systematically check each item below against your actual output.

Review criteria:

- `antithesis/scratchbook/sut-analysis.md` exists and covers architecture, state management, concurrency model, and failure-prone areas
- `antithesis/scratchbook/property-catalog.md` exists and lists concrete, testable properties — not vague goals like "test failover"
- Each property has a priority and a rationale for its chosen Antithesis assertion type (`Always`, `Sometimes`, `Reachable`, etc.)
- `antithesis/scratchbook/deployment-topology.md` exists and describes a minimal container topology — every container is justified
- Properties focus on timing-sensitive, concurrency-sensitive, and partial-failure scenarios where Antithesis is strongest
- Claimed guarantees from docs, comments, or issues are represented as properties
- Assumptions and open questions are recorded in the scratchbook, not left implicit
- The outputs are concrete enough for `antithesis-setup` and `antithesis-workload` to use directly — no ambiguous steps or missing details
