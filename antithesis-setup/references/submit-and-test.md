# Submit and Test

How to test locally and submit to Antithesis.

## Defer to using `antithesis-launch`

Use the `antithesis-launch` skill to kick off a run. That skill should handle all that's needed to kick off a run with Antithesis. If for some reason, the `antithesis-launch` skill is not present, fall back to using the steps listed below.  

## Build the Images

Run `snouty doctor` first. It checks the container runtime and the compose CLI.
Report both to the user, then build with that same pair. This file writes
`docker compose`; use `docker-compose` instead when that is the CLI snouty names.

snouty never builds or pulls images. Every image the compose file references must
already be in the image store of the engine snouty selects. Use
`run_in_background: true` for the build to avoid timeouts.

With a Docker engine:

```sh
docker compose -f antithesis/config/docker-compose.yaml build
```

With a podman engine, export `DOCKER_HOST` to podman's API socket first. Compose
looks for a Docker daemon otherwise, and `podman compose` is not a substitute.

```sh
podman info --format '{{.Host.RemoteSocket.Exists}}'   # must print true
export DOCKER_HOST="unix://$(podman info --format '{{.Host.RemoteSocket.Path}}')"
docker compose -f antithesis/config/docker-compose.yaml build
```

A fresh podman install reports a socket path but does not listen on it, and
`snouty doctor` still passes. Start the socket with `systemctl --user enable
--now podman.socket` when `RemoteSocket.Exists` prints false.

On macOS podman runs in a VM, so take the host-forwarded socket from `podman
machine inspect` rather than the in-VM path `podman info` reports.

snouty prefers podman when both engines are installed, and the two keep separate
image stores. Export `SNOUTY_CONTAINER_ENGINE=docker` when you build with docker
on a machine that also has podman.

## Local Testing First

Before submitting to Antithesis, test locally:

- Run any language-specific local instrumentation checks described in `references/instrumentation.md`, such as `nm` or `ldd`, before relying on the first Antithesis run to catch packaging mistakes.
- Verify that all built images target `amd64`. For each locally built image, run `<engine> image inspect <image> --format '{{.Architecture}}'` with the engine snouty selects, and confirm the output is `amd64`. If any image reports `arm64`, the `platform: linux/amd64` directive is missing or ineffective — fix the compose file before proceeding.
- Use `snouty validate /path/to/config-dir` to ensure that the compose setup can reach setup complete and any configured test-templates work.
- This step is not complete until you can test the deployment locally and prove the harness is ready for workload execution.

## Preparing Submission

- Review all files in the antithesis directory.
- Rebuild the images if anything changed since the build above. The `platform: linux/amd64` directive in each service targets x86-64 even on ARM hosts.
- Snouty handles the rest: it pushes tagged images, consumes the config directory, interpolates env vars, and launches the run.

## Environment Setup

- Determine `ANTITHESIS_REPOSITORY` before submission. If it is readable from the current environment, reuse it. Otherwise, ask the user for the registry value.
- Ensure `ANTITHESIS_REPOSITORY` is exported in the environment before running `snouty launch`.
- Authenticate the container engine snouty selects to the registry. Onboarding covers this for Antithesis-provisioned registries; log in manually for user-owned ones.
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
