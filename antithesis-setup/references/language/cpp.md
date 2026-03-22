# C and C++ Instrumentation

First, use the `antithesis-documentation` skill to load the latest Antithesis docs for C/C++ instrumentation before applying this guidance.

- `https://antithesis.com/docs/using_antithesis/sdk/cpp/instrumentation/`

You MUST use the latest version of the Antithesis C/C++ SDK. To lookup the latest version, load `https://api.github.com/repos/antithesishq/antithesis-sdk-cpp/tags` and find the tag representing the latest version.

Use the C++ SDK instrumentation header and LLVM sanitizer coverage flags.

- Add the Antithesis C++ SDK headers to the build so SUT code can emit at least one bootstrap assertion.
- Include `antithesis_instrumentation.h` in exactly one translation unit, typically the file with `main`.
- Compile with `-fsanitize-coverage=trace-pc-guard -g`.
- Link with `-Wl,--build-id`.
- Ensure the resulting binary or separate debug info is available under `/symbols/` in the runtime image.
- Validate locally with `nm <binary> | grep antithesis_load_libvoidstar`.
