# Submit and Test

How to test locally and submit to Antithesis.

## Local Testing First

Before submitting to Antithesis, test locally:

- Use `podman compose` if available; fall back to `docker compose`.
- Verify that the compose file builds using either `podman compose -f /path/to/config/docker-compose.yaml build` or `docker compose -f /path/to/config/docker-compose.yaml build`.
- Run any language-specific local instrumentation checks described in `references/instrumentation.md`, such as `nm` or `ldd`, before relying on the first Antithesis run to catch packaging mistakes.
- Use `snouty validate /path/to/config-dir` to ensure that the compose setup can reach setup complete and any configured test-templates work.
- This step is not complete until you can test the deployment locally and prove the harness is ready for workload execution.

## Preparing Submission

- Review all files in the antithesis directory.
- Ensure either `podman compose -f antithesis/config/docker-compose.yaml build` or `docker compose -f antithesis/config/docker-compose.yaml build` exits cleanly.
- Prefer a checked-in wrapper such as `antithesis/submit.sh` that runs either `podman compose -f antithesis/config/docker-compose.yaml build` or `docker compose -f antithesis/config/docker-compose.yaml build` and then calls `snouty run --config antithesis/config`.
- Only call `snouty run` directly when the build step has already been handled.
- Snouty handles the rest: it pushes tagged images, consumes the config directory, interpolates env vars, and launches the run.

## Environment Setup

- Determine `ANTITHESIS_REPOSITORY` before submission. If it is readable from the current environment, reuse it. Otherwise, ask the user for the registry value.
- Ensure `ANTITHESIS_REPOSITORY` is exported in the environment before running `snouty run`.
- Ensure Docker or Podman is authenticated to the registry.
- For Antithesis-provisioned registries, onboarding covers auth setup.
- For user-owned registries, configure Docker/Podman login manually.
- Ensure the relevant images contain `/opt/antithesis/catalog/` or `/symbols/` exactly as required by the chosen instrumentation path.
- Ensure the SUT image actually contains the Antithesis SDK dependency and the code path containing the bootstrap assertion.

## First Run

```sh
export ANTITHESIS_REPOSITORY=registry.example.com/team/project

./antithesis/submit.sh --duration 30 --desc "first test run"
```

Start with a short duration to verify the SUT works. Iterate with the user to fix issues. Document any durable issues or follow-up decisions in the relevant Antithesis notebook file under `antithesis/notebook/`.

After the first run, review the triage report for:

- `Software was instrumented` in the `Setup` property group
- the bootstrap property emitted by setup, a simple `reachable` check in a startup or readiness path
- any symbolization or instrumentation failures under `No Antithesis session errors`
