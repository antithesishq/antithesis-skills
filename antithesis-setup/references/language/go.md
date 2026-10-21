# Go Instrumentation

First, use the `antithesis-documentation` skill to load the latest Antithesis docs for Go instrumentation before applying this guidance.

- `https://antithesis.com/docs/reference/sdk/go/instrumentation.md`

You MUST use the latest version of the Antithesis Go SDK. To look up the latest version, load `https://proxy.golang.org/github.com/antithesishq/antithesis-sdk-go/@latest` and use the returned `Version`; use that same version for `antithesis-go-toolexec`.

## CGO is required

All Go code instrumented by Antithesis or using the Antithesis Go SDK MUST be compiled with `CGO_ENABLED=1`.

- Never set `CGO_ENABLED=0` anywhere in the build path. This includes Dockerfile `ENV` directives, `go build` invocations, Makefiles, build scripts, and CI configuration — even when the upstream project sets it for cross-compilation, static binaries, or smaller images.
- Set `CGO_ENABLED=1` explicitly in the build stage so it's not silently inherited from a parent image or environment.
- Ensure a C toolchain is present in the build image (`gcc` on glibc-based images, `gcc` + `musl-dev` on musl-based images). Prefer glibc base images (`golang:1.x`, `debian`, `ubuntu`) over `golang:1.x-alpine` to avoid musl-related instrumentation issues — see `references/docker-images.md`.

## Always do full instrumentation (coverage + cataloging)

- Use the default mode. Do not set `ANTITHESIS_SKIP_COVERAGE` or `ANTITHESIS_SKIP_CATALOG`; coverage instrumentation is what lets Antithesis steer the search.
- In a multi-stage Dockerfile, copy `/symbols` from the build stage into the runtime image alongside the binary.
- Add a tiny startup or readiness assertion using the Go SDK before you consider setup complete.

## Instrument the workload too, not just the SUT

Every Go binary that imports `antithesis-sdk-go`, including the workload and any test driver, MUST be built with `antithesis-go-toolexec` under the same rules as the SUT. Otherwise its assertions are not cataloged and silently fail to appear in the triage report. If the report shows fewer assertions than you defined, check this first.
