# Java Instrumentation

First, use the `antithesis-documentation` skill to load the latest Antithesis docs for Java instrumentation before applying this guidance.

- `https://antithesis.com/docs/using_antithesis/sdk/java/how_to_build_with_sdk/`

Java instrumentation and assertion cataloging are automatic bytecode weaving steps performed by Antithesis on compiled artifacts.

- Add the Antithesis Java SDK dependency to the application build.
- Place the relevant `.jar` or `.war` files, or directories containing them, in `/opt/antithesis/catalog/`.
- No source changes or build-system changes are required for instrumentation itself.
- Antithesis gathers Java symbol information automatically, so do not create a separate `/symbols` requirement unless your packaging has a special need.
- Start applications with an explicit classpath that includes the folder containing the injected Antithesis dependencies, for example `java -ea -cp "/opt/app/bin/*" ...`.
- Do not launch the app with `java -jar ...` when Antithesis-injected dependencies are required.
