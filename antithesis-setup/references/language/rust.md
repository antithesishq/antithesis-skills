# Rust Instrumentation

First, use the `antithesis-documentation` skill to load the latest Antithesis docs for Rust integration before applying this guidance.

- `https://antithesis.com/docs/using_antithesis/sdk/rust/`
- `https://antithesis.com/docs/using_antithesis/sdk/rust/instrumentation/`

You MUST use the latest version of both Antithesis Rust crates. To look up the latest versions, load the crates.io API and use `crate.max_stable_version`:

- SDK (assertions, randomness, lifecycle): `https://crates.io/api/v1/crates/antithesis_sdk`
- Instrumentation (coverage + libvoidstar): `https://crates.io/api/v1/crates/antithesis-instrumentation`

## SDK crate

Add the Antithesis Rust SDK to the crate graph for any rust code that will emit assertions, request randomness, or signal lifecycle events.

```toml
[dependencies]
antithesis_sdk = "0.2"
```

Call `antithesis_sdk::antithesis_init()` as soon as possible at program startup.

Outside Antithesis, behavior depends on the build:

- **`full` feature (the default):** the SDK is fully compiled in — assertions evaluate, the catalog registers, and randomness functions return values.
- **default features disabled:** a true no-op — assertion and lifecycle calls compile away to nothing.

## Instrumentation

Instrumentation is a single unit: the `antithesis-instrumentation` crate **and** the coverage `rustflags` must both be applied together. The crate links the Antithesis runtime but does nothing without the flags; the flags emit coverage that has nothing to link against without the crate. Doing one without the other produces an invalid binary — always do both.

1. Add the crate to `Cargo.toml`:

   ```toml
   [dependencies]
   antithesis-instrumentation = "0.1"
   ```

2. Reference it at least once in your Rust code so Cargo does not drop it as unused during linking:

   ```rust
   use antithesis_instrumentation as _;
   ```

3. Build with the coverage `rustflags`. The `--build-id` link arg is mandatory for symbolization. Specify the flags either in `.cargo/config.toml` or on the command line, preferring the Cargo config file.

`.cargo/config.toml`:

```toml
[build]
target = "x86_64-unknown-linux-gnu"

[target.x86_64-unknown-linux-gnu]
rustflags = [
    "-Ccodegen-units=1",
    "-Cpasses=sancov-module",
    "-Cllvm-args=-sanitizer-coverage-level=3",
    "-Cllvm-args=-sanitizer-coverage-trace-pc-guard",
    "-Clink-args=-Wl,--build-id",
]
```

Command line:

```bash
cargo build --bin main \
    --config 'build.target = "x86_64-unknown-linux-gnu"' \
    --config 'target.x86_64-unknown-linux-gnu.rustflags = [
        "-Ccodegen-units=1",
        "-Cpasses=sancov-module",
        "-Cllvm-args=-sanitizer-coverage-level=3",
        "-Cllvm-args=-sanitizer-coverage-trace-pc-guard",
        "-Clink-args=-Wl,--build-id",
    ]'
```

## Symbols

Symlink the DWARF debug symbols (or unstripped binaries) into `/symbols` at the container root to expose symbols to Antithesis.

## Validation

Confirm instrumentation linked correctly by checking for the libvoidstar loader symbol:

```shell
nm <binary> | grep antithesis_load_libvoidstar
```

Expect a line ending in `T antithesis_load_libvoidstar` (the `T` indicates it is in the text section).
