# Submit

How to submit to Antithesis.

## Preparing Submission

- Review all files in the antithesis directory.

## Environment Setup

- Determine `ANTITHESIS_REPOSITORY` before submission. If it is readable from the current environment, reuse it. Otherwise, ask the user for the registry value.
- Ensure `ANTITHESIS_REPOSITORY` is exported in the environment before running the `antithesis-launch` skill.
- Ensure Docker or Podman is authenticated to the registry so that relevant images can be pushed up.
- For Antithesis-provisioned registries, onboarding covers auth setup.
- For user-owned registries, configure Docker/Podman login manually.
- Ensure the relevant images contain `/opt/antithesis/catalog/` or `/symbols/` exactly as required by the chosen instrumentation path.
- Ensure the SUT image actually contains the Antithesis SDK dependency and the code path containing the bootstrap assertion.

## First Run

## Defer to using `antithesis-launch`

```sh
export ANTITHESIS_REPOSITORY=registry.example.com/team/project
```

Use the `antithesis-launch` skill to kick off a run. That skill should handle all that's needed to kick off a run with Antithesis. 

Start with a short duration to verify the SUT works. Iterate with the user to fix issues. Document any durable issues or follow-up decisions in the relevant Antithesis scratchbook file under `antithesis/scratchbook/`.

## Watch the first run

Stream the run as soon as it has a run id:

```sh
snouty runs stream "$RUN_ID" > first-run.stream
```

- Once stderr prints `the stream of run <id> is open`, check `snouty runs properties "$RUN_ID" --group Setup` for `Software was instrumented`, and watch the stream for a `verdict <id> passed` line on the bootstrap property.
- If no properties appear after the stream opens, or the Setup properties are in but the bootstrap still hasn't passed, ask the user to cancel (`snouty runs cancel "$RUN_ID"`) and fix the setup instead of waiting for the run to finish.

When the run finishes, check the triage report for symbolization or instrumentation failures under `No Antithesis session errors`.
