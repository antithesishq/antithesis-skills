# Rust Instrumentation

First, use the `antithesis-documentation` skill to load the latest Antithesis docs for Rust instrumentation before applying this guidance.

- `https://antithesis.com/docs/using_antithesis/sdk/rust/instrumentation/`

Use LLVM-based instrumentation and the Antithesis runtime library.

- Add the Antithesis Rust SDK crate to the crate graph for the code that will emit assertions.
- Vendor or otherwise cache `libvoidstar.so`; do not rely on fetching it during every build.
- Install `libvoidstar.so` at `/usr/lib/libvoidstar.so` in the container and ensure it is on the library search path.
- Build with the documented `RUSTFLAGS`
- Place DWARF debug artifacts or unstripped binaries in `/symbols/`.
- Validate locally with `ldd <binary> | grep libvoidstar` and `nm <binary> | grep sanitizer_cov_trace_pc_guard`.
