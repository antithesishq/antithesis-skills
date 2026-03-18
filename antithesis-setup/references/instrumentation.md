# Instrumentation

How to decide whether the SUT needs Antithesis instrumentation, how to enable it, how to install the relevant SDK into the SUT dependency graph, and how to provide symbols for triage.

## Goal

Produce an Antithesis harness where each relevant SUT component is either:

- instrumented with the language-appropriate mechanism, with assertion cataloging enabled when the SDK needs it, or
- explicitly left uninstrumented for a documented reason

Also ensure symbol files are available to Antithesis when the language requires them.

Also ensure the relevant Antithesis SDK is actually linked into the SUT or SUT-adjacent code path that will emit assertions, lifecycle signals, or randomness requests.

## Why This Matters

Instrumentation gives Antithesis continuous coverage feedback, enables thread pausing, and improves report quality. Some SDK assertion workflows also depend on assertion cataloging. The exact setup is language-dependent, so determine the implementation language for every binary, service, or module before you write Dockerfiles.

Treat symbolization as part of instrumentation, not as a separate optional enhancement. If Antithesis cannot map instrumented code back to source locations, it will report session errors and the triage report will be less useful.

The first proof that the integration works should be a tiny SDK-backed property in a simple, guaranteed-to-run code path. Do not wait for the full workload to add the first assertion to the system.

## Start With A Per-Service Inventory

For each SUT service or binary:

1. Record the implementation language and build system.
2. Record whether the service already uses an Antithesis SDK for assertions, lifecycle, or randomness.
3. Decide whether the service should be instrumented, cataloged-only, or left uninstrumented.
4. Record where its runtime artifact lives in the container image.
5. Record what symbol files, if any, must be placed in `/symbols`.
6. Record where a minimal bootstrap assertion can be added with low risk.

Write the result down in the Antithesis notebook when the answer is non-obvious.

## Cross-Language Rules

- Instrument the actual binaries or runtime artifacts that will execute inside Antithesis, not an unrelated local build output.
- Install the language-appropriate Antithesis SDK into the dependency graph of the code that will emit assertions or lifecycle events.
- Build and validate instrumentation before the first `snouty run`.
- If you add assertions later, rerun the relevant instrumentor or rebuild path so assertion cataloging stays current.
- If a language relies on `/opt/antithesis/catalog/`, avoid symlink chains deeper than one hop inside that tree.
- If a language relies on `/symbols`, place the files in the image that contains the instrumented software.
- If a service cannot be instrumented, document why and continue with the best supported SDK integration you can provide.

## Bootstrap Assertion Requirement

As part of setup, add one minimal property in a simple SUT code path to prove that:

- the SDK is installed correctly
- assertion cataloging is working
- the chosen instrumentation path is wired correctly
- the assertion appears in the Antithesis report

Prefer a `reachable` property over a deep business invariant for this first check.

Good locations include:

- service startup after configuration loads successfully
- a health-check or readiness endpoint handler
- a top-level request path that every test run should hit
- a simple client/server handshake path that already exists

Good property shape:

- `reachable("service startup path executed")`

Keep this first property extremely simple. Its purpose is integration verification, not business validation. Use a stable, human-readable message so its history remains comparable across runs.

## Language-Specific References

After you determine the language for each service, read the matching reference file:

- `references/language/go.md`
- `references/language/cpp.md`
- `references/language/rust.md`
- `references/language/java.md`
- `references/language/dotnet.md`
- `references/language/javascript.md`
- `references/language/python.md`
- `references/language/fallback.md`

Use `references/language/fallback.md` as the generic catch-all for any unlisted language. It covers the fallback SDK path for any language and the optional LLVM coverage path for languages compiled through LLVM.

If the deployment is polyglot, read every relevant file before you touch Dockerfiles or build steps. These files own the language-specific SDK installation, instrumentation flow, symbol handling, and local validation details.

## Image Construction Guidance

When adapting Dockerfiles for Antithesis:

- Add any instrumentation-only build tools, compile flags, or helper binaries in Antithesis-specific stages when practical.
- Ensure the runtime image includes the Antithesis SDK dependencies needed by the code path that emits the bootstrap property.
- Add `/opt/antithesis/catalog/` for languages that rely on catalog discovery.
- Add `/symbols/` for languages that require explicit symbol delivery.
- Prefer symlinking into `/symbols/` when the original debug artifact already exists elsewhere in the image.
- Ensure the final runtime image launches the instrumented artifact, not the original pre-instrumented build output.

If multiple services share the same Dockerfile, make each service target explicit so symbol and catalog handling stays tied to the right image.

## Validation Checklist

Before submission, verify all of the following that apply:

- The build process actually produced instrumented artifacts.
- The relevant SDK dependency is present in the artifact or runtime environment that will emit assertions.
- The bootstrap assertion is present in a simple SUT path and is not hidden behind rare behavior.
- `/opt/antithesis/catalog/` contains the expected files for Java, .NET, JavaScript, or Python services.
- `/symbols/` exists and contains the correct files or symlinks for Go, Rust, C, C++, or other LLVM-instrumented services.
- Local runtime checks from the language docs pass, such as `nm` or `ldd`.
- The first Antithesis run reports `Software was instrumented` under the `Setup` property group.
- The first Antithesis run also shows the bootstrap property with the expected message.
- The triage report does not show symbolization-related session errors under `No Antithesis session errors`.

If instrumentation is missing in the report, fix the image contents or build flags first. Do not treat missing instrumentation as a minor cleanup item.

## Documentation Grounding

- Coverage instrumentation: `https://antithesis.com/docs/instrumentation/coverage_instrumentation/`
- Assertion cataloging: `https://antithesis.com/docs/instrumentation/assertion_cataloging/`
