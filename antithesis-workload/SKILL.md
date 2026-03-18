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

- Properties from the `antithesis-research` skill are mapped to concrete assertions
- Test commands exist under `antithesis/test/` and exercise the right behaviors
- The first real test templates are created after setup, or existing ones are expanded
- Triage findings turn into workload or property updates instead of staying implicit

Use the `antithesis-research` skill first to build the property catalog. Use the `antithesis-setup` skill to scaffold the infrastructure. Use the `antithesis-triage` skill to review runs, then return here to improve the workload.

## Prerequisites and Scoping

Start from the existing Antithesis notebook, test code, and triage artifacts first. Ask the user only for blockers or scoping decisions you cannot infer safely, such as:

- The property catalog location, if it is not the standard `antithesis/notebook/property-catalog.md`
- Which properties to implement, if the request is narrower than the full catalog
- The project language or SDK choice, if the repo does not make it obvious
- Triage findings or known gaps, if iterating on an existing workload

## Definitions and Concepts

- **SUT:** System under test.
- **Test template:** A directory of test commands at `/opt/antithesis/test/v1/{name}/`. Each timeline runs commands from one test template. Files or subdirectories prefixed with `helper_` are ignored by Test Composer, so use that prefix for helper scripts kept alongside commands.
- **Test command:** An executable in a test template with a valid prefix: `parallel_driver_`, `singleton_driver_`, `serial_driver_`, `first_`, `eventually_`, `finally_`, `anytime_`.
- **Timeline:** One linear execution of the SUT and workload. Antithesis runs many timelines in parallel and branches them to search for interesting behaviors.
- **`Always` / `AlwaysOrUnreachable`:** Assertions for safety and correctness properties.
- **`Sometimes`:** Assertions for liveness or "did we reach this state?" checks.
- **`Reachable` / `Unreachable`:** Assertions about whether code paths or behaviors are exercised.

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
4. Update the workload and the relevant Antithesis notebook artifacts together

## General Guidance

- Keep Antithesis-only code out of production paths. If you must touch shared code, make the change surgical and easy to wall off.
- Prefer simple workload code over highly configurable abstractions.
- Assume `antithesis-setup` has already made the system runnable in a mostly idle state; this skill owns what the workload does once the system is up.
- Assume `antithesis-setup` has already installed the relevant SDK and added one minimal bootstrap assertion in the SUT. This skill owns the broader property catalog beyond that initial integration check.
- Write test commands in the project's language, not Bash, so they can reuse the project's clients, helpers, and libraries.

## Output

- Test commands and supporting workload code under `antithesis/test/`
- Assertions in workload code or carefully chosen SUT locations
- Updates to `antithesis/notebook/property-catalog.md` when the implemented properties change
