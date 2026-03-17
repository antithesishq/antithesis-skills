# Docker Compose

How to write the docker-compose.yaml.

## Goal

Create a working Docker Compose config at `antithesis/config/docker-compose.yaml`.

## Image References

Services use one of two patterns:

- **Local images** use `build:` with a context path and `image:` with `${ANTITHESIS_REPOSITORY}/name:tag`. Build these in `submit.sh` before invoking `snouty run`.
- **Public images** use `image:` directly (e.g. `docker.io/library/postgres:17.2`).

Before writing `${ANTITHESIS_REPOSITORY}/...` tags, check whether `ANTITHESIS_REPOSITORY` is already available in the current environment. If not, ask the user for the registry value and tell them it must be exported before running `antithesis/submit.sh`.

Example:
```yaml
services:
  myapp:
    build:
      context: ../..
      dockerfile: Dockerfile
    image: ${ANTITHESIS_REPOSITORY}/myapp:latest

  postgres:
    image: docker.io/library/postgres:17.2
```

## Podman Compose Compatibility

Antithesis uses `podman compose` behind the scenes. For compatibility, prefer `podman compose` over `docker compose` when testing locally. Use `podman compose` if available; otherwise fall back to `docker compose`.

## Hermetic Execution

The compose config must run without internet access. All images must be pre-built or available in the Antithesis registry.

## setup_complete Signal

Ensure at least one entrypoint emits the `setup_complete` event. Use `antithesis/setup-complete.sh` or call the SDK's setup complete method. Only emit once the system is healthy and ready for testing.

## Named Volumes

If you need reliable communication between containers, mount a named volume to every container. Useful for sharing configuration files.

## Test Template Mounting

Ensure the test directory path will be available at `/opt/antithesis/test/v1/` in the appropriate container(s) once workload code is added. This skill only needs to wire the environment so later workload templates can run there; defining those templates belongs to `antithesis-workload`.
