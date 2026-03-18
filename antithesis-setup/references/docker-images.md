# Docker Images

How to create Docker images for the SUT.

## Determine Required Images

Consult the deployment topology from the Antithesis notebook, typically `notebook/deployment-topology.md`, to determine which images are needed.

## Dependencies

Use existing Docker images where possible (e.g., official postgres, minio for S3).

## Services

Find existing Dockerfiles in the project or create new ones. If creating a Dockerfile, create it at `antithesis/Dockerfile` and use named build stages to split different services.

Apply the `references/instrumentation.md` decisions while you adapt images:

- For Java, .NET, JavaScript, and Python flows that rely on Antithesis catalog discovery, add `/opt/antithesis/catalog/` and populate it with the runtime artifacts Antithesis should scan.
- For Go, Rust, C, C++, and similar LLVM-style flows, ensure the final runtime image contains the instrumented artifact and exposes the required symbol files under `/symbols/`.
- Prefer symlinks into `/symbols/` when the original debug files already exist elsewhere in the image and the docs permit it.
- Keep instrumentation-only toolchain changes out of unrelated production image paths when practical by using Antithesis-specific build stages.

Check the current environment for `ANTITHESIS_REPOSITORY` before using `${ANTITHESIS_REPOSITORY}` in image tags. If it is not available, ask the user for the registry value and tell them it must be exported before running `snouty run`.

Reference each local image in `docker-compose.yaml` with both `build:` (for local `compose build`) and `image:` (for the registry tag):

```yaml
services:
  myapp:
    build:
      context: ../..
      dockerfile: antithesis/Dockerfile
      target: myapp    # if using multi-stage builds
    image: ${ANTITHESIS_REPOSITORY}/myapp:latest
```

## Clients

If the deployment includes a client or workload image, make sure it can later receive test templates at `/opt/antithesis/test/v1/`. The `antithesis-setup` skill does not need to create real test templates; it only needs to preserve the path and image structure that `antithesis-workload` will use. If helper files later live inside a template, prefix their file or directory names with `helper_` so Test Composer ignores them.

## Requirements

- All images must target Linux x86-64.
- Follow the Docker best practices guide: `https://antithesis.com/docs/best_practices/docker_best_practices.md`
