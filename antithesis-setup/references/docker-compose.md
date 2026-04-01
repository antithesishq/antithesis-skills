# Docker Compose

How to write the docker-compose.yaml.

## Goal

Create a working Docker Compose config at `antithesis/config/docker-compose.yaml`.

## Project Name

Set the top-level `name:` field to the SUT's project name. This controls the Compose project name and auto-prefixes service containers, networks, and volumes. For example, for a project called `foobar`:

```yaml
name: foobar
```

## Image References

Services use one of two patterns:

- **Local images** use `build:` with a context path and `image:` with `name:tag`. Build these before invoking `snouty run`.
- **Public images** use `image:` directly (e.g. `docker.io/library/postgres:17.2`).

Every service must include `platform: linux/amd64` because Antithesis runs on x86-64. This applies to both local and public images — without it, builds and pulls on ARM hosts (e.g. macOS Apple Silicon) will produce the wrong architecture.

Example:

```yaml
name: foobar

services:
  server:
    container_name: foobar-server
    platform: linux/amd64
    build:
      context: ../..
      dockerfile: Dockerfile
    image: foobar-server:latest

  postgres:
    container_name: foobar-postgres
    platform: linux/amd64
    image: docker.io/library/postgres:17.2
```

## Podman Compose Compatibility

Antithesis uses `podman compose` behind the scenes. For compatibility, prefer `podman compose` over `docker compose` when testing locally. Use `podman compose` if available; otherwise fall back to `docker compose`.

## Hermetic Execution

The compose config must run without internet access. All images must be pre-built or available in the Antithesis registry.

## setup_complete Signal

Ensure at least one entrypoint emits the `setup_complete` event. Use `antithesis/setup-complete.sh` or call the SDK's setup complete method. Only emit once the system is healthy and ready for testing. Do not emit `setup_complete` from `antithesis/test/` or from any `first_` command; those commands do not start until after Antithesis has already observed `setup_complete`.

## Named Volumes

If you need reliable communication between containers, mount a named volume to every container. Useful for sharing configuration files.

## Test Template Mounting

Ensure the test directory path will be available at `/opt/antithesis/test/v1/` in the appropriate container(s) once workload code is added. This skill only needs to wire the environment so later workload templates can run there; defining those templates belongs to `antithesis-workload`.
