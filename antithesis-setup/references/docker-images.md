# Docker Images

How to create Docker images for the SUT.

## Determine Required Images

Consult the deployment topology from the Antithesis scratchbook, typically `antithesis/scratchbook/deployment-topology.md`, to determine which images are needed.

## Dependencies

Use existing Docker images where possible (e.g., official postgres, minio for S3).

## Services

Find existing Dockerfiles in the project or create new ones. If creating a Dockerfile, create it at `antithesis/Dockerfile` and use named build stages to split different services.

When you need to write a new Dockerfile, prefer glibc-based base images. Default to the latest Debian slim image unless the project already has a stronger existing convention or a service has a specific runtime requirement that points elsewhere. Avoid introducing Alpine or other musl-based images as the default Antithesis path unless there is a clear reason to do so.

Apply the `references/instrumentation.md` decisions while you adapt images:

- For Java, .NET, JavaScript, and Python flows that rely on Antithesis catalog discovery, add `/opt/antithesis/catalog/` and populate it with the runtime artifacts Antithesis should scan.
- For Go, Rust, C, C++, and similar LLVM-style flows, ensure the final runtime image contains the instrumented artifact and exposes the required symbol files under `/symbols/`.
- Prefer symlinks into `/symbols/` when the original debug files already exist elsewhere in the image and the docs permit it.
- Keep instrumentation-only toolchain changes out of unrelated production image paths when practical by using Antithesis-specific build stages.

### Image Naming

Image names must include a prefix derived from the SUT's project name so that images are immediately identifiable. For example, if the project is called `foobar`:

- `foobar-server:latest`
- `foobar-workload:latest`
- `foobar-config:latest`

Do not use generic names like `server`, `workload`, or `config` without the project prefix.

Reference each local image in `docker-compose.yaml` with both `build:` (for local `compose build`) and `image:` (for the registry tag). Every service must include `platform: linux/amd64` because Antithesis runs on x86-64. Without this, builds on ARM hosts (e.g. macOS Apple Silicon) will produce images with the wrong architecture.

```yaml
services:
  server:
    container_name: foobar-server
    platform: linux/amd64
    build:
      context: ../..
      dockerfile: antithesis/Dockerfile
      target: server
    image: foobar-server:latest
```

## Clients

If the deployment includes a client or workload image, make sure it can later receive test templates at `/opt/antithesis/test/v1/`. The `antithesis-setup` skill does not need to create real test templates; it only needs to preserve the path and image structure that `antithesis-workload` will use. If helper files later live inside a template, prefix their file or directory names with `helper_` so Test Composer ignores them.

## Disable Color Output

Antithesis collects and stores raw bytes from container output. ANSI escape codes (colors, cursor movement, etc.) are not rendered and appear as garbage in logs and triage output. **Disable color output in every container image.**

Set this environment variable in every Dockerfile (or in docker-compose.yaml environment blocks):

```dockerfile
ENV NO_COLOR=1
```

`NO_COLOR` is a widely adopted convention (see https://no-color.org/) honored by most CLI tools, test frameworks, and language runtimes.

Additionally, if the SUT or its dependencies have their own color flags (e.g. `--no-color`, `FORCE_COLOR=0`, `GCC_COLORS=`, `PYTEST_ADDOPTS=--no-header -p no:color`), disable those too. The goal is zero ANSI escape sequences in any container output.

## Requirements

- All images must target Linux x86-64. Set `platform: linux/amd64` on every service in docker-compose.yaml — both `build:` services and `image:`-only services (public images like postgres will also pull the wrong architecture on ARM hosts without it).
- All images must disable color/ANSI output. Set `NO_COLOR=1` in every container environment.
- Follow the Docker best practices guide: `https://antithesis.com/docs/best_practices/docker_best_practices.md`
