# Get a Moment

Infer which moment to use based on the user's prompt. The user may ask you to get a moment from a few different sources:

- **`snouty runs properties` (live or finished run).** A failing property's `counterexamples` each carry a `moment`; get them by exact name (`antithesis-triage`, `references/properties.md`). Telemetry and meta properties have no `moment`.
- **A moment pasted from the Antithesis UI.** The report's copy moment button
  gives a `Moment.from({ ... })` blob. A copied log line or a free-form message can also contain one. Extract params (like `input_hash` and `vtime`) out of the blob yourself and pass them as flags to snouty.
- **`snouty runs stream` (live run).** A counterexample `sample` line is a moment on the run itself; exec on the run directly. If exec answers "Moment not warm", the run has most likely ended, open a debugging session.
- **`snouty runs search` (past run).** Every event it returns carries a `moment` with
  `input_hash` and `vtime`. Write a query that matches exactly what you want:

  ```bash
  # failing evaluations of a property (drop the ! for passing ones)
  snouty --json runs search "$RUN_ID" \
    'filter(ev => ev.antithesis_assert?.hit
      && ev.antithesis_assert.id == "<property name>"
      && !ev.antithesis_assert.condition)'

  # a log line
  snouty --json runs search "$RUN_ID" 'contains({output_text: "<error text>"})'

  # an assertion, by its message (assertions have no output_text)
  snouty --json runs search "$RUN_ID" \
    'filter(ev => ev.antithesis_assert?.message?.includes("<message text>"))'
  ```

  Results are a sample, in no fixed order, capped at `--limit`. Run
  `snouty runs search --help` for the full query language.
- **An instruction to go find one.** If the user says something like "debug
  the failing `Counter` property" or "run a command at an event
  containing the error message XYZ," resolve the concrete input hash and vtime
  first: `runs properties` for a failing property, `runs stream` for one that
  fails while you watch a live run, `runs search` for a log line or a specific
  evaluation.
