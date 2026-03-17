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

- Read `ANTITHESIS_REPOSITORY` from the current environment if it is available.
- If `ANTITHESIS_REPOSITORY` is not available, ask the user for the registry value before writing compose image tags.
- Build compose services referenced via `build:` by using `compose build` before `snouty run`.
- Ensure images that Snouty should push are tagged under `ANTITHESIS_REPOSITORY`.
- Let Snouty consume the config directory, interpolate environment variables, and launch the run.
