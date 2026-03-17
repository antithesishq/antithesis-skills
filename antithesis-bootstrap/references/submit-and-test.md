# Submit and Test

How to test locally and submit to Antithesis.

## Local Testing First

Before submitting to Antithesis, test locally:

- Update `antithesis/test.sh` to bring up and test the environment. See TODOs in the template file.
- Use `podman compose` if available; fall back to `docker compose`.
- Verify the system comes up, emits `setup_complete`, and can remain healthy in a mostly idle state.
- If workload commands already exist, verify they can run successfully, but creating or defining them belongs to `antithesis-workload`.
- This step is not complete until you can test the deployment locally and prove the harness is ready for workload execution.

## Preparing Submission

- Review all files in the antithesis directory.
- Ensure `antithesis/submit.sh` uses `podman compose build` or `docker compose build` before calling `snouty run --config antithesis/config`.
- Snouty handles the rest: it pushes tagged images, consumes the config directory, interpolates env vars, and launches the run.

## Environment Setup

- Determine `ANTITHESIS_REPOSITORY` before submission. If it is readable from the current environment, reuse it. Otherwise, ask the user for the registry value.
- Ensure `ANTITHESIS_REPOSITORY` is exported in the environment before running `antithesis/submit.sh`.
- Ensure Docker or Podman is authenticated to the registry.
- For Antithesis-provisioned registries, onboarding covers auth setup.
- For user-owned registries, configure Docker/Podman login manually.

## First Run

```sh
export ANTITHESIS_REPOSITORY=registry.example.com/team/project

./antithesis/submit.sh \
    --duration 30 --desc "first test run"
```

Start with a short duration to verify the SUT works. Iterate with the user to fix issues. Document any durable issues or follow-up decisions in the relevant Antithesis notebook file under `antithesis/notebook/`.
