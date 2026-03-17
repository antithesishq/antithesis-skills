# Submit and Test

How to test locally and submit to Antithesis.

## Local Testing First

Before submitting to Antithesis, test locally:

- Use `podman compose` if available; fall back to `docker compose`.
- Verify that the compose file builds using `compose -f /path/to/config/docker-compose.yaml build`.
- Use `snouty validate /path/to/config` to ensure that the compose setup can reach setup complete.
- This step is not complete until you can test the deployment locally and prove the harness is ready for workload execution.

## Preparing Submission

- Review all files in the antithesis directory.
- Ensure `compose build` exits cleanly.
- Call `snouty run --config antithesis/config`.
- Snouty handles the rest: it pushes tagged images, consumes the config directory, interpolates env vars, and launches the run.

## Environment Setup

- Determine `ANTITHESIS_REPOSITORY` before submission. If it is readable from the current environment, reuse it. Otherwise, ask the user for the registry value.
- Ensure `ANTITHESIS_REPOSITORY` is exported in the environment before running `snouty run`.
- Ensure Docker or Podman is authenticated to the registry.
- For Antithesis-provisioned registries, onboarding covers auth setup.
- For user-owned registries, configure Docker/Podman login manually.

## First Run

```sh
export ANTITHESIS_REPOSITORY=registry.example.com/team/project

snouty run -w basic_test --config antithesis/config \
    --duration 30 --description "first test run"
```

Start with a short duration to verify the SUT works. Iterate with the user to fix issues. Document any durable issues or follow-up decisions in the relevant Antithesis notebook file under `antithesis/notebook/`.
