# .NET Instrumentation

First, use the `antithesis-documentation` skill to load the latest Antithesis docs for .NET instrumentation before applying this guidance.

- `https://antithesis.com/docs/using_antithesis/sdk/dotnet/instrumentation/`

You MUST use the latest version of the Antithesis .NET SDK. To look up the latest version, load `https://api.nuget.org/v3-flatcontainer/antithesis.sdk/index.json` and use the last entry in the `versions` array.

.NET instrumentation is automatic bytecode weaving over compiled assemblies.

- Add the Antithesis .NET SDK package to the application project that will emit assertions.
- Place the relevant `*.dll` and `*.exe` files, or directories containing them, in `/opt/antithesis/catalog/`.
- Antithesis recursively instruments supported assemblies except `System.*.dll` and `Microsoft.*.dll`.
- Strong-named assemblies cannot be instrumented and will be skipped.
- Antithesis gathers symbol information automatically, so no extra `/symbols` directory is required for normal .NET setups.
