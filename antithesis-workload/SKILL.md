---
name: antithesis-workload
description: >
  Implement Antithesis workloads by turning the property catalog into SDK
  assertions and test commands, then refine coverage after triage.
compatibility: Requires snouty (https://github.com/antithesishq/snouty).
metadata:
  version: "2026-04-17 06d067d"
---

# Antithesis Workload

## Purpose and Goal

Implement or improve the Antithesis workload. Success means:

- Properties from the `antithesis-research` skill are mapped to concrete assertions, using both the property catalog and per-property evidence files
- Test commands exist under `antithesis/test/` and exercise the right behaviors
- The first real test templates are created after setup, or existing ones are expanded
- Triage findings turn into workload or property updates instead of staying implicit

Use the `antithesis-research` skill first to build the property catalog. Use the `antithesis-setup` skill to scaffold the infrastructure. Use the `antithesis-triage` skill to review runs, then return here to improve the workload. If the user asks to submit or launch a run, use the `antithesis-launch` skill — do not run `snouty run` directly.

## Prerequisites

- DO NOT PROCEED if the Antithesis scratchbook (usually at `antithesis/scratchbook/`) doesn't exist. Use the `antithesis-research` skill to create it.
- DO NOT PROCEED if there is no `docker-compose.yaml` for Antithesis present. Use the `antithesis-setup` skill to create it.
- DO NOT PROCEED if `snouty` is not installed. See `https://raw.githubusercontent.com/antithesishq/snouty/refs/heads/main/README.md` for installation options.

# Scoping

Each invocation of the "Implement next property" workflow below focuses on **one property** to keep context manageable and quality high. (Post-triage iteration follows its own scoping based on triage findings.)

If the user asks for multiple properties, recommend doing one at a time — explain that implementation quality degrades as context accumulates, and each property's effort is unpredictable. Ask which one they'd like to start with. If they insist on multiple, proceed — but warn them first.

If the user specifies which property to work on, skip the full catalog scan — but still assess that property's status against its evidence file before proceeding. If it's already fully implemented, tell the user rather than redoing work.

If the user does not specify a property, run the full detection and recommendation flow below.

## Detect implementation status

The detection work below is context-heavy (reading every evidence file, scanning the codebase for assertions). If your agent supports sub-agents, delegate it to a sub-agent that returns a per-property summary (status + brief rationale). This keeps the main implementation agent's context clean.

The detection task: for each property in the catalog, search the existing test and SUT code for Antithesis SDK assertion calls and cross-reference them with the property's evidence file at `antithesis/scratchbook/properties/{slug}.md`. Assess whether the existing assertions cover the code paths, failure scenarios, and instrumentation points the evidence file describes. Classify each property as:

- **Implemented** — assertions cover what the evidence file describes
- **Partially implemented** — some assertions exist but coverage is incomplete
- **Not implemented** — no related assertions found

## Present and recommend

Note the catalog's provenance frontmatter (`commit` and `updated` fields) and include it when presenting status — e.g., "The property catalog is up-to-date as of `<commit short hash>` (`<date>`)." This lets the user judge whether the catalog reflects the current codebase or needs re-research.

Show the user the status of each property, then recommend one to implement next. Prefer partially-implemented properties that need completion, then unimplemented properties that cluster with recently implemented ones (see `antithesis/scratchbook/property-relationships.md`), then other high-priority unimplemented properties. Wait for the user to confirm or choose differently before proceeding.

For the chosen property, read both the catalog entry and its evidence file.

## Other scoping questions

Ask the user only for blockers or scoping decisions you cannot infer safely, such as:

- The property catalog location, if it is not the standard `antithesis/scratchbook/property-catalog.md`
- The project language or SDK choice, if the repo does not make it obvious
- Triage findings or known gaps, if iterating on an existing workload

## Definitions and Concepts

- **SUT:** System under test.
- **Test template:** A directory of test commands at `/opt/antithesis/test/v1/{name}/`. Each timeline runs commands from one test template. Files or subdirectories prefixed with `helper_` are ignored by Antithesis, so use that prefix for helper scripts kept alongside commands.
- **Test command:** An executable in a test template with a valid prefix: `parallel_driver_`, `singleton_driver_`, `serial_driver_`, `first_`, `eventually_`, `finally_`, `anytime_`.
- **Timeline:** One linear execution of the SUT and workload. Antithesis runs many timelines in parallel and branches them to search for interesting behaviors.
- **`Always` / `AlwaysOrUnreachable`:** Assertions for safety and correctness properties.
- **`Sometimes(cond)`:** Assertions for liveness or non-trivial semantic states that should occur at least once.
- **`Reachable` / `Unreachable`:** Assertions about whether meaningful outcomes or forbidden paths are exercised.

## Documentation Grounding

Use the `antithesis-documentation` skill to access these pages. Prefer `snouty docs`.

- Test commands reference: `https://antithesis.com/docs/test_templates/test_composer_reference.md`
- SDK reference: `https://antithesis.com/docs/using_antithesis/sdk.md`
- Properties and assertions: `https://antithesis.com/docs/properties_assertions/assertions.md`
- Fault injection: `https://antithesis.com/docs/environment/fault_injection.md`

## Reference Files

| Reference                                | When to read                                      |
| ---------------------------------------- | ------------------------------------------------- |
| `references/component-implementation.md` | Implementing workload-side components or wrappers |
| `references/assertions.md`               | Turning properties into SDK assertions            |
| `references/test-commands.md`            | Writing commands and organizing test templates    |
| `references/iteration.md`                | Improving coverage and assertions after triage    |

## Recommended Workflows

### Implement next property

1. Detect implementation status and present to user (see Scoping above)
2. Get user confirmation on which property to implement
3. Read `references/component-implementation.md`
4. Read `references/assertions.md`
5. Read `references/test-commands.md`
6. Implement the chosen property: assertions, test commands, and supporting code

### Post-triage iteration

1. Read `references/iteration.md`
2. Read `references/assertions.md` if assertions need to change
3. Read `references/test-commands.md` if command coverage needs to change
4. Update the workload and the relevant Antithesis scratchbook artifacts together

## General Guidance

- Keep Antithesis-only code out of production paths. If you must touch shared code, make the change surgical and easy to wall off.
- Prefer simple workload code over highly configurable abstractions.
- Assume `antithesis-setup` has already made the system runnable in a mostly idle state; this skill owns what the workload does once the system is up.
- Assume `antithesis-setup` has already installed the relevant SDK and added one minimal bootstrap assertion in the SUT. This skill owns the broader property catalog beyond that initial integration check.
- Write test commands in the project's language, not Bash, so they can reuse the project's clients, helpers, and libraries.

## Output

- Assertions for every property in scope, in workload code or carefully chosen SUT locations
- Test commands and supporting workload code under `antithesis/test/`
- Updates to `antithesis/scratchbook/property-catalog.md` when the implemented properties change

## Self-Review

Before declaring this skill complete, review your work against the criteria below. If your agent supports spawning sub-agents, create a new agent with fresh context to perform this review — give it the path to this skill file and have it read all output artifacts. A fresh-context reviewer catches blind spots that in-context review misses. If your agent does not support sub-agents, perform the review yourself: re-read the success criteria at the top of this file, then systematically check each item below against your actual output.

Review criteria:

- For every property in scope, the implementation covers the code paths, failure scenarios, and instrumentation points described in its evidence file — not just "an assertion exists" but "the assertions cover what the evidence says needs to be covered"
- Each assertion uses the correct SDK assertion type for its property's semantics (`Always`/`AlwaysOrUnreachable` for safety, `Sometimes(cond)` for liveness or meaningful semantic state, `Reachable`/`Unreachable` for path and outcome checks)
- `Sometimes(true, ...)` assertions should be rewritten as `Reachable(...)`.
- Assertion messages are unique across the touched code; no broad property is implemented by reusing one message at multiple unrelated callsites
- Workload-only instrumentation was not used where surgical SUT-side assertions would provide materially better search guidance for rare, dangerous, or timing-sensitive internal states
- `Reachable(...)` markers are attached to distinct outcomes or branch results, not redundant early path-entry locations on the same straight-line flow
- Test commands exist under `antithesis/test/` and use valid prefixes (`parallel_driver_`, `singleton_driver_`, `serial_driver_`, `first_`, `eventually_`, `finally_`, `anytime_`)
- Test commands are written in the project's language, not Bash, and reuse the project's clients and libraries where possible
- No test command is responsible for Antithesis lifecycle signaling; `setup_complete` is emitted before test commands begin
- Test templates are structured correctly at the path that will map to `/opt/antithesis/test/v1/{name}/` in the container
- Helper files or directories are prefixed with `helper_` so Antithesis ignores them
- `antithesis/scratchbook/property-catalog.md` is updated to reflect the implementation status of every property in scope, with provenance frontmatter (`commit` and `updated`) reflecting the current codebase state
- Assertions are in workload code or surgical SUT locations — not scattered across production paths
- Use `snouty validate` on `antithesis/config` to ensure that the compose setup can reach setup complete and any configured test-templates work. Make sure to build the latest images before running validate.
