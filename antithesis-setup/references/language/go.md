# Go Instrumentation

First, use the `antithesis-documentation` skill to load the latest Antithesis docs for Go instrumentation before applying this guidance.

- `https://antithesis.com/docs/using_antithesis/sdk/go/instrumentor/`

You MUST use the latest version of the Antithesis Go SDK. To look up the latest version, load `https://proxy.golang.org/github.com/antithesishq/antithesis-sdk-go/@latest` and use the returned `Version`; use that same version for `antithesis-go-instrumentor`.

Use the Antithesis Go instrumentor before compilation. This is a source transformation step, so it must run in your build or CI flow before container packaging.

- Add `github.com/antithesishq/antithesis-sdk-go` to the module dependency graph.
- Install `github.com/antithesishq/antithesis-sdk-go` and the `antithesis-go-instrumentor` tool.
- Use `antithesis-go-instrumentor -assert_only` when you only need assertion cataloging.
- Use the default mode when you want both cataloging and coverage instrumentation.
- The instrumentor writes `customer/`, `symbols/`, and `notifier/` output directories.
- Build the binary from the instrumented `customer/` tree, not the original source tree.
- Copy the emitted `.sym.tsv` file into `/symbols/` in the runtime image with the exact generated filename.
- Add a tiny startup or readiness assertion using the Go SDK before you consider setup complete.
