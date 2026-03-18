# Unlisted Languages

Use this reference for any language that does not have a first-class Antithesis language page in this skill.

## Fallback SDK

First, use the `antithesis-documentation` skill to load the latest Antithesis docs relevant the fallback SDK.

- `https://antithesis.com/docs/using_antithesis/sdk/fallback/`

The fallback SDK path works for any language because it relies on writing JSONL messages to Antithesis rather than linking a language-native SDK.

- Use this path for assertions and lifecycle when no first-class SDK is available or practical.
- Implement the JSONL writer as part of the SUT or a very thin SUT-adjacent wrapper.
- Carefully follow documented JSON schemas and write messages out to the correct path.

## LLVM Instrumentation

If the unlisted language compiles through LLVM, you may also be able to enable coverage instrumentation in addition to the fallback SDK path.

- The docs say LLVM-based languages may still be compatible with Antithesis instrumentation, but this is not a fully supported path.
- If you proceed, make sure debug symbols or unstripped binaries are available in `/symbols/`.
- Keep the fallback SDK path for assertions and lifecycle unless you have a better language-native integration.

Refer to the `references/language/cpp.md` and `references/language/rust.md` language guides for hints on which flags to provide to LLVM to correctly setup instrumentation.

You may also need to link to `libvoidstar.so`.
