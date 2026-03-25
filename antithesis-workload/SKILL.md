---
name: antithesis-workload
description: >
  Implement Antithesis workloads by turning the property catalog into SDK
  assertions and test commands, then refine coverage after triage.
keywords:
  - antithesis
  - workload
  - assertions
  - test commands
  - test templates
  - properties
  - SDK
---

# Antithesis Workload

## Purpose and Goal

Implement or improve the Antithesis workload. Success means:

- Properties from the `antithesis-research` skill are mapped to concrete assertions, using both the property catalog and per-property evidence files
- Test commands exist under `antithesis/test/` and exercise the right behaviors
- The first real test templates are created after setup, or existing ones are expanded
- Triage findings turn into workload or property updates instead of staying implicit

Use the `antithesis-research` skill first to build the property catalog. Use the `antithesis-setup` skill to scaffold the infrastructure. Use the `antithesis-triage` skill to review runs, then return here to improve the workload.

## Prerequisites

- DO NOT PROCEED if the Antithesis scratchbook (usually at `antithesis/scratchbook/`) doesn't exist. Use the `antithesis-research` skill to create it.
- DO NOT PROCEED if there is no `docker-compose.yaml` for Antithesis present. Use the `antithesis-setup` skill to create it.
- DO NOT PROCEED if `snouty` is not installed. See `https://raw.githubusercontent.com/antithesishq/snouty/refs/heads/main/README.md` for installation options.

# Scoping

Start from the existing Antithesis scratchbook, test code, and triage artifacts first. For each property being implemented, read both the catalog entry and the corresponding evidence file at `antithesis/scratchbook/properties/{slug}.md`. The evidence file contains the detailed context — code paths, failure scenarios, instrumentation points, and key observations — that the catalog entry summarizes.

Ask the user only for blockers or scoping decisions you cannot infer safely, such as:

- The property catalog location, if it is not the standard `antithesis/scratchbook/property-catalog.md`
- Which properties to implement, if the request is narrower than the full catalog
- The project language or SDK choice, if the repo does not make it obvious
- Triage findings or known gaps, if iterating on an existing workload

## Definitions and Concepts

- **SUT:** System under test.
- **Test template:** A directory of test commands at `/opt/antithesis/test/v1/{name}/`. Each timeline runs commands from one test template. Files or subdirectories prefixed with `helper_` are ignored by Test Composer, so use that prefix for helper scripts kept alongside commands.
- **Test command:** An executable in a test template with a valid prefix: `parallel_driver_`, `singleton_driver_`, `serial_driver_`, `first_`, `eventually_`, `finally_`, `anytime_`.
- **Timeline:** One linear execution of the SUT and workload. Antithesis runs many timelines in parallel and branches them to search for interesting behaviors.
- **`Always` / `AlwaysOrUnreachable`:** Assertions for safety and correctness properties.
- **`Sometimes(cond)`:** Assertions for liveness or non-trivial semantic states that should occur at least once.
- **`Reachable` / `Unreachable`:** Assertions about whether meaningful outcomes or forbidden paths are exercised.

## Documentation Grounding

Use the `antithesis-documentation` skill to access these pages. Prefer `snouty docs`.

- Test templates reference: `https://antithesis.com/docs/test_templates/test_composer_reference.md`
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

### Initial workload implementation

1. Read `references/component-implementation.md`
2. Read `references/assertions.md`
3. Read `references/test-commands.md`
4. Implement or update `antithesis/test/` and any supporting workload code

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

- Test commands and supporting workload code under `antithesis/test/`
- Assertions in workload code or carefully chosen SUT locations
- Updates to `antithesis/scratchbook/property-catalog.md` when the implemented properties change

## Self-Review

Before declaring this skill complete, review your work against the criteria below. If your agent supports spawning sub-agents, create a new agent with fresh context to perform this review — give it the path to this skill file and have it read all output artifacts. A fresh-context reviewer catches blind spots that in-context review misses. If your agent does not support sub-agents, perform the review yourself: re-read the success criteria at the top of this file, then systematically check each item below against your actual output.

Review criteria:

- Every property in the catalog that was in scope has a corresponding SDK assertion in the workload or SUT code
- Each assertion uses the correct SDK assertion type for its property's semantics (`Always`/`AlwaysOrUnreachable` for safety, `Sometimes(cond)` for liveness or meaningful semantic state, `Reachable`/`Unreachable` for path and outcome checks)
- `Sometimes(true, ...)` assertions should be rewritten as `Reachable(...)`.
- Assertion messages are unique across the touched code; no broad property is implemented by reusing one message at multiple unrelated callsites
- Workload-only instrumentation was not used where surgical SUT-side assertions would provide materially better search guidance for rare, dangerous, or timing-sensitive internal states
- `Reachable(...)` markers are attached to distinct outcomes or branch results, not redundant early path-entry locations on the same straight-line flow
- Test commands exist under `antithesis/test/` and use valid prefixes (`parallel_driver_`, `singleton_driver_`, `serial_driver_`, `first_`, `eventually_`, `finally_`, `anytime_`)
- Test commands are written in the project's language, not Bash, and reuse the project's clients and libraries where possible
- No test command is responsible for Antithesis lifecycle signaling; `setup_complete` is emitted before test commands begin
- Test templates are structured correctly at the path that will map to `/opt/antithesis/test/v1/{name}/` in the container
- Helper files or directories are prefixed with `helper_` so Test Composer ignores them
- `antithesis/scratchbook/property-catalog.md` is updated to reflect which properties are now implemented
- Assertions are in workload code or surgical SUT locations — not scattered across production paths
- Use `snouty validate` on `antithesis/config` to ensure that the compose setup can reach setup complete and any configured test-templates work. Make sure to build the latest images before running validate.
