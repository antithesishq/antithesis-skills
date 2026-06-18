---
name: antithesis-research
description: >
  Analyze a codebase to figure out how it should be tested with Antithesis:
  map the system, identify failure-prone areas and testable properties, and
  produce the research artifacts needed for workload and environment planning.
metadata:
  version: "2026-06-18 4d70d62"
---

# Antithesis Research

## Purpose and Goal

Research a target system and produce scratchbook artifacts that unblock the rest of the workflow. Success means:

- `antithesis/scratchbook/sut-analysis.md` captures architecture, state, concurrency, and failure-prone areas
- `antithesis/scratchbook/property-catalog.md` lists concrete, testable properties with priorities
- `antithesis/scratchbook/deployment-topology.md` describes the minimal useful container topology
- `antithesis/scratchbook/properties/{slug}.md` captures per-property evidence trails and context
- `antithesis/scratchbook/property-relationships.md` maps suspected clusters and connections between properties
- `antithesis/scratchbook/evaluation/synthesis.md` records categorized evaluation findings and actions taken

## Prerequisites and Scoping

At the start of every research run, ask the user about external references:

> Before I start, are there docs, design notes, related repos, issue trackers, or anything else outside this directory tree that I should also consult? "Just this directory" is fine.

Capture the answer verbatim. Each external reference becomes a `path` (or URL) plus a brief `why` note. The orchestrator (this skill) holds the answer for the full duration of the run and threads it as input to every reference workflow that produces a top-level artifact: `sut-discovery.md`, `sut-analysis.md`, `property-discovery.md`, `deployment-topology.md`, `property-evaluation.md`. Each of those references' agent-instruction sections accepts the list as input. The list is also recorded in the provenance frontmatter of every top-level artifact (see `references/scratchbook-setup.md`).

Beyond the scope question, ask only for blockers or scoping decisions you cannot infer safely:

- The repo or codebase location, if it is not already clear
- Which subsystem or component matters most, if the work is narrower than the whole repo
- Known incidents, closed bugs, or specific failure modes worth targeting

If scratchbook artifacts already exist, treat them as inputs and extend them instead of rewriting them unless the user asks for a fresh pass.

## Definitions and Concepts

- **SUT:** System under test.
- **Workload:** A synthetic workload designed to exercise the target system
- **Safety property (correctness):** A bad thing never happens
- **Liveness property (progress):** A good thing eventually happens
- **Reachability property:** A code path or behavior is reachable or unreachable
- **Test Template:** A directory of test commands located at `/opt/antithesis/test/v1/{name}/`. There may be more than one test template. Each timeline executes commands from a single test template. Files or subdirectories prefixed with `helper_` are ignored by Antithesis.
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
| `references/sut-discovery.md`       | Discovering system characteristics through structured attention focuses |
| `references/sut-analysis.md`        | General methodology for analyzing the codebase and understanding components |
| `references/property-discovery.md`  | Discovering properties through structured attention focuses |
| `references/property-catalog.md`    | Format and methodology for documenting properties   |
| `references/faults.md`              | Understanding fault types, quiet periods, and process fault availability |
| `references/deployment-topology.md` | Designing the container topology for Antithesis     |
| `references/property-evaluation.md` | Evaluating the property catalog as a portfolio       |

## Recommended Workflows

### Full research pass (new project)

1. Read `references/scratchbook-setup.md`
2. Read `references/sut-discovery.md` and `references/sut-analysis.md`
3. Analyze the system using the ensemble or single-agent workflow from `references/sut-discovery.md`
4. Scan the codebase for existing Antithesis SDK assertions. Search for imports
   of the Antithesis SDK and calls to assertion functions (`assert_always!`,
   `assert_sometimes!`, `assert_reachable!`, `assert_unreachable!`, or their
   non-macro equivalents). For each assertion found, record the file path, line
   number, assertion type, and message string. Write the results to
   `antithesis/scratchbook/existing-assertions.md`. Begin the file with
   provenance frontmatter per `references/scratchbook-setup.md`. If no
   assertions are found, write the file with a note confirming the codebase has
   no existing instrumentation.
5. Read `references/property-discovery.md` and `references/property-catalog.md`
6. Discover properties using the ensemble or single-agent workflow from `references/property-discovery.md`
7. Read `references/deployment-topology.md`
8. Design the deployment topology and write it to `antithesis/scratchbook/deployment-topology.md`
9. Read `references/property-evaluation.md`
10. Evaluate the property catalog using the ensemble or single-agent workflow from `references/property-evaluation.md`
11. Address evaluation findings: apply refinements, fill gaps, escalate biases to the user
12. Write or update all remaining findings in the scratchbook under `antithesis/scratchbook/`

### Targeted property research

1. Read `references/sut-discovery.md` and `references/sut-analysis.md` if the system model is missing or stale
2. Read `references/property-discovery.md` and `references/property-catalog.md`
3. Discover properties using the ensemble or single-agent workflow from `references/property-discovery.md`
4. Turn claimed guarantees, incidents, and bug reports into explicit properties, and choose the Antithesis assertion type that matches each one
5. Update `antithesis/scratchbook/property-catalog.md` and record assumptions or open questions
6. Write evidence files for new properties to `antithesis/scratchbook/properties/{slug}.md`
7. Update `antithesis/scratchbook/property-relationships.md` with any new clusters or connections
8. Read `references/property-evaluation.md`
9. Evaluate the updated property catalog using the ensemble or single-agent workflow from `references/property-evaluation.md`
10. Address evaluation findings: apply refinements, fill gaps, escalate biases to the user

### Property expansion (after triage)

1. Read `references/property-discovery.md` and `references/property-catalog.md`
2. Review triage findings from the `antithesis-triage` skill
3. Use the attention focuses from `references/property-discovery.md` to look for new properties inspired by triage findings
4. Update the relevant files in the scratchbook
5. Write evidence files for new properties to `antithesis/scratchbook/properties/{slug}.md`
6. Update `antithesis/scratchbook/property-relationships.md` with any new clusters or connections
7. If the expansion is substantial (a new category of properties or more than 3
   new properties), read `references/property-evaluation.md` and evaluate the
   updated catalog. Small expansions of 1-3 properties in existing categories
   do not require a full evaluation pass.

## General Guidance

- Prefer specific, checkable guarantees over vague goals like "test failover"
- If the system claims a guarantee in docs, comments, or issues, try to make it a property
- Record not just the invariant, but why the chosen Antithesis assertion type is the right semantic fit for that property
- Use `Sometimes(cond)` for liveness or non-trivial semantic states, not for invariants that must hold on every evaluation and not as a substitute for `Reachable(...)`
- Identify where surgical SUT-side assertions would give materially better search guidance than workload-only checks, especially for rare, dangerous, timing-sensitive, or externally invisible states
- Remember that Antithesis SDK assertions do not crash the program on failure; they are intended to be safe in production code and usually become low-overhead fallbacks or no-ops outside Antithesis
- Focus on timing-sensitive, concurrency-sensitive, and partial-failure scenarios where Antithesis is strongest
- Keep the deployment topology minimal; every extra container expands state space
- Write down assumptions and open questions in the scratchbook instead of keeping them implicit
- If only part of the research is requested, still update the relevant scratchbook files and note what remains undone

## Output

- `antithesis/scratchbook/sut-analysis.md`
- `antithesis/scratchbook/existing-assertions.md`
- `antithesis/scratchbook/property-catalog.md`
- `antithesis/scratchbook/deployment-topology.md`
- `antithesis/scratchbook/property-relationships.md`
- `antithesis/scratchbook/properties/{slug}.md` (one per cataloged property)
- `antithesis/scratchbook/evaluation/synthesis.md`
- `antithesis/scratchbook/evaluation/{lens}.md` (one per evaluation lens)

All top-level scratchbook artifacts (everything in the list above except per-property evidence files) include provenance frontmatter recording `sut_path`, `commit`, `updated`, and `external_references`. Per-property evidence files inherit context from `property-catalog.md` and do not need their own frontmatter. See `references/scratchbook-setup.md`.

These outputs should be concrete enough for the `antithesis-setup` skill and the `antithesis-workload` skill to use directly.

## Self-Review

Before declaring this skill complete, review your work against the criteria below. If your agent supports spawning sub-agents, create a new agent with fresh context to perform this review — give it the path to this skill file and have it read all output artifacts. A fresh-context reviewer catches blind spots that in-context review misses. If your agent does not support sub-agents, perform the review yourself: re-read the success criteria at the top of this file, then systematically check each item below against your actual output.

Review criteria:

- `antithesis/scratchbook/sut-analysis.md` exists and covers architecture, state management, concurrency model, and failure-prone areas
- `antithesis/scratchbook/existing-assertions.md` exists and lists all Antithesis SDK assertions found in the codebase (or explicitly states none were found)
- Evidence files correctly distinguish between instrumentation that already exists in the codebase, instrumentation that is partially present, and instrumentation that is missing — no evidence file suggests adding an assertion that is already there
- `antithesis/scratchbook/property-catalog.md` exists, has provenance frontmatter per `references/scratchbook-setup.md`, and lists concrete, testable properties — not vague goals like "test failover"
- Every top-level artifact begins with provenance frontmatter per `references/scratchbook-setup.md`
- The `external_references` list reflects the user's stated scope answer; entries that were referenced have a `why` note explaining their use
- The scope question was asked at the start of the run, and the user's answer was passed to every sub-agent that performed analysis
- Each property has a descriptive kebab-case slug as its canonical ID
- Each property has a priority and a rationale for its chosen Antithesis assertion type (`Always`, `Sometimes`, `Reachable`, etc.)
- Properties that need internal branch guidance or replay anchors call out likely SUT-side instrumentation points, not just workload-visible checks
- `antithesis/scratchbook/deployment-topology.md` exists and describes a minimal container topology — every container is justified
- Every cataloged property has a corresponding evidence file at `antithesis/scratchbook/properties/{slug}.md` that captures the evidence trail, relevant code paths, and key observations
- Each property's catalog entry includes an Open Questions list that mirrors the unresolved questions from its evidence file (short summaries; full context stays in the evidence file). Resolved questions are removed; remaining questions are tagged per `references/property-catalog.md` ("Open Questions Conventions").
- Each `(partial: ...)` or `(needs human input)` tag is backed by an investigation log entry in the evidence file (see `references/property-catalog.md` "Investigation Log") that records what was examined, what was found, and what wasn't. Untagged (not yet investigated) questions don't require a log entry. Unresolved questions that need human input are an acceptable outcome — they must be visible in the catalog overview, not buried in evidence files.
- Properties invalidated by investigation are marked in the catalog with the reason
- `antithesis/scratchbook/property-relationships.md` exists and groups related properties into clusters with brief notes on suspected connections and dominance
- Every property slug referenced in `property-relationships.md` corresponds to a property in the catalog
- Properties focus on timing-sensitive, concurrency-sensitive, and partial-failure scenarios where Antithesis is strongest
- Claimed guarantees from docs, comments, or issues are represented as properties
- Property evaluation was performed: `antithesis/scratchbook/evaluation/synthesis.md` exists with categorized findings
- Evaluation refinements have been applied to the catalog
- Evaluation gaps have been filled via targeted discovery, and the resulting properties are in the catalog with evidence files
- Evaluation biases (if any) have been presented to the user with supporting evidence
- The outputs are concrete enough for `antithesis-setup` and `antithesis-workload` to use directly — no ambiguous steps or missing details
