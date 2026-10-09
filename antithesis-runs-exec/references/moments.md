# Get a Moment

Infer which moment to use based on the user's prompt. The user may ask you to get a moment from a few different sources:

- **A moment pasted from the Antithesis UI.** The report's copy moment button
  gives a `Moment.from({ ... })` blob. A copied log line or a free-form message can also contain one. Extract params (like `input_hash` and `vtime`) out of the blob yourself and pass them as flags to snouty.
- **The API.** Moments come back from `snouty runs show $RUN_ID` (the failure
  moment of an incomplete run), `snouty runs --json properties "$RUN_ID"`
  (example / counterexample moments per property), and the `moment` attached
  to every entry from `snouty runs logs` and `snouty runs events`.
- **An instruction to go find one.** If the user says something like "debug 
  the failing `Counter` property" or "run a command at an event
  containing the error message XYZ," use the API sources above to resolve the
  concrete input hash and vtime first.
