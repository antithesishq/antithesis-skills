This directory contains files relevant to running tests in Antithesis.

Use the `antithesis-bootstrap` skill to scaffold and manage this directory. Use the `antithesis-research` skill to analyze the system and build a property catalog. Use the `antithesis-workload` skill to implement assertions and test commands.

**submit.sh**
Use this script to build any local compose images, then launch an Antithesis test run via `snouty run`.

**snouty validate**
Use this command to quickly validate changes to the Antithesis scaffolding. See `snouty validate --help` for details.

**setup-complete.sh**
Inject this script into a Dockerfile to notify Antithesis that setup is complete. This script should only run once the system under test is ready for testing. Antithesis will not run any test commands until it receives this event. You may use the Antithesis SDK's setup complete method instead if it makes more sense for your system.

**config**
This directory contains the `docker-compose.yaml` file used to bring up this system within the Antithesis environment, along with any closely related config files. When compose uses `${ANTITHESIS_REPOSITORY}`, ensure it is exported in the environment before running `submit.sh`. `submit.sh` should build any local images from `build:` directives before passing this directory to `snouty run --config`. Snouty will push tagged images, consume this config directory, and launch the run.

**notebook**
This directory is the Antithesis notebook for the codebase. It contains the durable Antithesis handoff artifacts, including system analysis, property catalogs, topology plans, and other persistent integration notes. It is shared across the `antithesis-research`, `antithesis-workload`, and `antithesis-bootstrap` skills. Keep it up to date as Antithesis-related decisions change.

**test**
This directory is where the `antithesis-workload` skill places test templates and related helpers. A test template is a directory containing test command executable files. Each test command must have a valid prefix: `parallel_driver_, singleton_driver_, serial_driver_, first_, eventually_, finally_, anytime_`. Prefixes constrain when and how commands are composed in a single timeline. Files or subdirectories prefixed with `helper_` are ignored by Test Composer and can be used for helper scripts kept alongside the commands.
