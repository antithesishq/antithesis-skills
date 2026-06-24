# Config Directory

The `antithesis/config/` directory should include the files Antithesis needs to bring up the system.

## What Goes There

**Compose path:**

- `docker-compose.yaml`
- Any environment-specific configuration consumed by the services in that compose config

**Kubernetes path** (see `references/kubernetes.md`):

- `manifests/` containing the strict Kubernetes YAML
- The config-image `Dockerfile` (`FROM scratch` + `COPY manifests/ /manifests/`) that packages those manifests

## What Does Not Go There

- Application source code
- Build contexts for SUT images
- Executable test commands or helper scripts
- Dockerfiles for SUT images (the k8s config-image Dockerfile above is the one exception — it carries manifests, not application code)

## Submission Flow

When using `snouty launch --json --webhook basic_test --config antithesis/config`:

- Build compose services referenced via `build:` by using `compose build` before `snouty launch`.
- Let Snouty consume the config directory, interpolate environment variables, and launch the run.
- On the Kubernetes path the config directory holds the config-image `Dockerfile` and `manifests/` instead of `docker-compose.yaml`; build the config image and SUT images with `docker build` rather than `compose build`. See `references/kubernetes.md`.
