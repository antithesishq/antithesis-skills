# Directory Initialization

How to initialize the antithesis working directory.

## Steps

1. Create `antithesis/` at the repo root (or user-specified location).
2. Initialize with template files from this skill's `assets/antithesis/` directory. Read `assets/antithesis/AGENTS.md` for the purpose of each file.
3. Keep the deployment-definition template for your path and delete the other (see "Determine the deployment type first" in `SKILL.md`):
   - **Compose path:** keep `config/docker-compose.yaml`; delete `config/manifests/`.
   - **Kubernetes path:** keep `config/manifests/kubernetes.yaml`; delete `config/docker-compose.yaml`. Also add the config-image `config/Dockerfile` (`FROM scratch` + `COPY manifests/ /manifests/`) — see `references/kubernetes.md`.

## Merging With Existing Content

If the `antithesis` directory already exists, ensure that it is up to date with the latest template in this skill's `assets/antithesis/` directory. Make sure to carefully merge any conflicts manually rather than copying over files. Don't remove existing files.
