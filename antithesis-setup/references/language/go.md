# Go Instrumentation

First, use the `antithesis-documentation` skill to load the latest Antithesis docs for Go instrumentation before applying this guidance.

- `https://antithesis.com/docs/using_antithesis/sdk/go/instrumentor/`

You MUST use the latest version of the Antithesis Go SDK. To look up the latest version, load `https://proxy.golang.org/github.com/antithesishq/antithesis-sdk-go/@latest` and use the returned `Version`; use that same version for `antithesis-go-instrumentor`.

## CGO is required

All Go code instrumented by Antithesis or using the Antithesis Go SDK MUST be compiled with `CGO_ENABLED=1`.

- Never set `CGO_ENABLED=0` anywhere in the build path. This includes Dockerfile `ENV` directives, `go build` invocations, Makefiles, build scripts, and CI configuration — even when the upstream project sets it for cross-compilation, static binaries, or smaller images.
- Set `CGO_ENABLED=1` explicitly in the build stage so it's not silently inherited from a parent image or environment.
- Ensure a C toolchain is present in the build image (`gcc` on glibc-based images, `gcc` + `musl-dev` on musl-based images). Prefer glibc base images (`golang:1.x`, `debian`, `ubuntu`) over `golang:1.x-alpine` to avoid musl-related instrumentation issues — see `references/docker-images.md`.

If an existing build sets `CGO_ENABLED=0`, change it to `1` for the Antithesis build path rather than working around it.

## Always do full instrumentation (coverage + cataloging)

Use the Antithesis Go instrumentor before compilation. This is a source transformation step, so it must run in your build or CI flow before container packaging.

- Add `github.com/antithesishq/antithesis-sdk-go` to the module dependency graph.
- Install `github.com/antithesishq/antithesis-sdk-go` and the `antithesis-go-instrumentor` tool.
- Run `antithesis-go-instrumentor` in its **default mode** — this performs both coverage instrumentation and assertion cataloging. Do not pass `-assert_only`. Coverage instrumentation is what lets Antithesis steer the search; skipping it strips some of the platform's value.
- The instrumentor writes `customer/`, `symbols/`, and `notifier/` output directories.
- Build the binary from the instrumented `customer/` tree, not the original source tree.
- Copy the emitted `.sym.tsv` file into `/symbols/` in the runtime image with the exact generated filename.
- Add a tiny startup or readiness assertion using the Go SDK before you consider setup complete.

## Instrument the workload too, not just the SUT

If the workload (or any test driver) is written in Go and uses the Antithesis SDK to emit assertions, it MUST be run through `antithesis-go-instrumentor` with the same flow as the SUT — otherwise its assertions will not be cataloged and will silently fail to appear in the triage report.

- Treat each Go binary that imports `antithesis-sdk-go` as its own instrumentation target.
- Apply the same CGO and default-mode rules above to the workload binary's build.
- Verify after the first run that the workload's assertions appear in the triage report. If the report shows fewer assertions than you defined, the workload almost certainly was not instrumented.
