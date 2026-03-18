# Config Directory

The `antithesis/config/` directory should include the files Antithesis needs to bring up the system.

## What Goes There

- `docker-compose.yaml`
- Any environment-specific configuration consumed by the services in that compose config

## What Does Not Go There

- Application source code
- Build contexts for SUT images
- Executable test commands or helper scripts
- Dockerfiles

## Submission Flow

When using `snouty run --config antithesis/config`:

- Build compose services referenced via `build:` by using `compose build` before `snouty run`.
- Let Snouty consume the config directory, interpolate environment variables, and launch the run.
