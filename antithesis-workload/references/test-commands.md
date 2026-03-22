# Test Commands

## Goal

Create test templates whose commands exercise the SUT in useful, diverse ways.

## Test Template Structure

A test template is a directory at `/opt/antithesis/test/v1/{name}/` containing test command files. A timeline runs commands from one test template. If you are unsure how to split coverage, start with one template. Files and subdirectories prefixed with `helper_` are ignored by Test Composer, so use that prefix for shared helpers that need to live inside the template.

## Test Command Prefixes and Their Behavior

- **`first_`**: Runs once at the start of a timeline. Use for per-timeline initialization.
- **`parallel_driver_`**: Runs concurrently and repeatedly. Use for steady load.
- **`serial_driver_`**: Runs in sequence. Use for ordered workflows.
- **`singleton_driver_`**: Runs once after drivers start. Use for one-off operations.
- **`eventually_`**: Runs with faults paused. Use for checks that need a stable system.
- **`finally_`**: Runs at the end of a timeline. Use for final validation.
- **`anytime_`**: Runs at any point, including during faults. Use for invariants that must hold under failure.

## Guidance

- Never emit `setup_complete` from `first_` or any other test command. Test commands do not run until after Antithesis receives `setup_complete`, so doing this will deadlock startup.
- Commands should eventually exit.
- Antithesis already checks that commands exit 0, so a non-zero exit should mean something is genuinely wrong.
- Treat commands as levers for the fuzzer. Diverse commands produce richer system states.
- Reserve `setup_complete` for a container entrypoint or other long-lived startup process that runs before Test Composer starts executing timeline commands.
- Test template directories may include helper files or helper directories prefixed with `helper_`; Test Composer ignores them.
- Any non-helper executable placed directly in a template should be a real test command with a valid prefix.
- Write commands in the project's language, not Bash, so they can reuse existing clients, helpers, and libraries.

## Output

One or more test templates containing test command executables written to `antithesis/test/`.
