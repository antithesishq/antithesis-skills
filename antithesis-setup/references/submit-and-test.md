# Submit and Test

How to test locally and submit to Antithesis.

## Defer to using `antithesis-launch`

Use the `antithesis-launch` skill to kick off a run. That skill should handle all that's needed to kick off a run with Antithesis. If for some reason, the `antithesis-launch` skill is not present, fall back to using the steps listed below.  

## Local Testing First

Before submitting to Antithesis, test locally:

- Run `snouty doctor` to see which compose CLI and container engine snouty selects. Build with that same pair. `references/docker-compose.md` lists the supported combinations and the exact build commands. Do not use `podman compose` or `podman-compose`.
- Verify that the compose file builds, for example with `docker compose -f /path/to/config/docker-compose.yaml build`. Use `run_in_background: true` for this command to avoid timeouts.
- Run any language-specific local instrumentation checks described in `references/instrumentation.md`, such as `nm` or `ldd`, before relying on the first Antithesis run to catch packaging mistakes.
- Verify that all built images target `amd64`. For each locally built image, run `<engine> image inspect <image> --format '{{.Architecture}}'` with the engine snouty selects, and confirm the output is `amd64`. If any image reports `arm64`, the `platform: linux/amd64` directive is missing or ineffective — fix the compose file before proceeding.
- Use `snouty validate /path/to/config-dir` to ensure that the compose setup can reach setup complete and any configured test-templates work.
- This step is not complete until you can test the deployment locally and prove the harness is ready for workload execution.

## Preparing Submission

- Review all files in the antithesis directory.
- Build images first with the compose CLI and engine from `references/docker-compose.md`. The `platform: linux/amd64` directive in each service ensures builds target x86-64 even on ARM hosts. Use `run_in_background: true` for this command to avoid timeouts.
- Snouty handles the rest: it pushes tagged images, consumes the config directory, interpolates env vars, and launches the run.

## Environment Setup

- Determine `ANTITHESIS_REPOSITORY` before submission. If it is readable from the current environment, reuse it. Otherwise, ask the user for the registry value.
- Ensure `ANTITHESIS_REPOSITORY` is exported in the environment before running `snouty launch`.
- Ensure the container engine snouty selects is authenticated to the registry.
- For Antithesis-provisioned registries, onboarding covers auth setup.
- For user-owned registries, configure the engine login manually.
- Ensure the relevant images contain `/opt/antithesis/catalog/` or `/symbols/` exactly as required by the chosen instrumentation path.
- Ensure the SUT image actually contains the Antithesis SDK dependency and the code path containing the bootstrap assertion.

## First Run

```sh
export ANTITHESIS_REPOSITORY=registry.example.com/team/project

# Build images (use run_in_background: true to avoid timeouts)
docker compose -f antithesis/config/docker-compose.yaml build

# Submit run
snouty launch \
  --json \
  --webhook basic_test \
  --config antithesis/config \
  --test-name "PROJECT_NAME" \
  --description "first test run" \
  --duration 30
```

Start with a short duration to verify the SUT works. Iterate with the user to fix issues. Document any durable issues or follow-up decisions in the relevant Antithesis scratchbook file under `antithesis/scratchbook/`.

After the first run, review the triage report for:

- `Software was instrumented` in the `Setup` property group
- the bootstrap property emitted by setup, a simple `reachable` check in a startup or readiness path
- any symbolization or instrumentation failures under `No Antithesis session errors`
