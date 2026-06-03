---
name: antithesis-triage
description: >
  Triage Antithesis test reports to understand what happened in a run: look
  up runs, check status, investigate failed properties (assertions), view
  metadata, download logs, inspect findings, and examine environmental
  details. Load after a run completes or when investigating a failure.
compatibility: Requires snouty (https://github.com/antithesishq/snouty), and jq.
metadata:
  version: "2026-06-03 7f2d61c"
---

# Antithesis Run Triage

Use this skill to analyze Antithesis test runs.

**Reference files:** This skill's `references/` directory contains detailed guides for specific tasks. Do NOT read them all up front — only read a reference file when you are told to. Each reference file is mentioned by name at the point where it is needed.

## Prerequisites

- DO NOT PROCEED if `snouty` is not installed. See `https://raw.githubusercontent.com/antithesishq/snouty/refs/heads/main/README.md` for installation options.
- DO NOT PROCEED if `snouty` is not at least version 0.5.0. Use `snouty --version` to find the version.
- DO NOT PROCEED if `jq` is not installed. See `https://jqlang.org/download/` for installation options.
- **Note:** `snouty runs` may be hidden from `snouty --help` but is still supported. If you need to confirm availability or see subcommand syntax, `snouty runs --help` still works.

### Preflight: confirm triage can work

This version of the triage skill talks to Antithesis through the snouty API (`snouty runs ...`). Before doing any work, confirm the setup is ready with the following command:

```bash
snouty doctor
```

If this command reports any failure, relay that failure to the user and stop. Do not attempt to interact with the Antithesis API until it passes.

You can skip preflight if you already know (from context or memory) that the user's setup is working.

## Gathering user input

Before starting, collect the following from the user:

1. **Tenant Name** (required) — You must know the tenant name. Check the `$ANTITHESIS_TENANT` environment variable. Ask the user if you do not have evidence for the tenant name.

2. **What they want to know** — Are they interested in all failures in a specific run? Are they investigating a specific failure? Are they getting a general overview? Comparing runs? This determines which workflow to follow.

## How to get information from a run

Your main method to obtain information is to use the `snouty runs <OPTION>` command with the `--json` option. The `--json` option returns line-delimited JSON. The fields in the JSON depend on the option you are using. The same command without `--json` returns fewer fields in a tabular form better suited for human consumption.

You will need to know the RUN_ID. Read `references/run-discovery.md` to learn how to obtain the run_id.

## Workflows

### Summarize recent runs

Read `references/run-discovery.md` to get a list of recent runs. Then summarize them in a report.

### Looking up a specific run

To look up a specific run (report), read `references/run-info.md`. Then continue with other workflows as needed.

### Triage a run

If the run has a status of "incomplete", refer to the `Diagnose incomplete run` section below.

1. Read `references/run-info.md` to load information on a run
2. If `links.triage_report` is null/absent in the run-info output, no triage report was generated for this run (typical for `cancelled` runs and some `unknown`/`starting` states). Report that the run is not triageable — the properties and logs endpoints will return 404 for these runs.
3. Read `references/properties.md` to load properties
4. Review passed/failed counts
5. Build a detailed summary of the run including a review of all failures as well as flagging any new failures.

### Investigate failed properties

1. Read `references/properties.md` - use `snouty runs --json properties` to extract properties with their examples and learn how to download logs
2. Read `references/logs.md` to learn how to understand logs
3. For each property to investigate:
   a. Pick the first failing example
   b. Find the moment. If the counterexample has no `moment` field (telemetry / meta properties — see `references/properties.md`), report the counterexample value as the evidence and skip steps c–e.
   c. Download the example's log using `snouty runs --json logs $RUN_ID $INPUT_HASH $VTIME`. Make sure vtime does not get rounded. `input_hash` and `vtime` should match exactly what is contained in the example's `moment` structure.
   d. Analyze the downloaded log locally
   e. If you aren't certain what caused the issue, consider downloading logs from other counterexamples and examples for the same property. Compare each occurrence and try to see if there are any similarities or differences that might explain the failure cause. Logs from passing examples can be useful to compare against to find differences between success and failure cases.

   When searching for additional logs for property failures, first use:

   ```bash
   snouty runs --json events ${RUN_ID} ${PROPERTY_NAME}
   ```

   This returns SOME but not necessarily ALL cases of the property passing or failing in the run. PROPERTY_NAME should match the "name" field
   in the property data you are investigating. Match the "hit" and "condition" fields against the examples or counterexamples you are trying to find more of. Note that it is likely the examples and counterexamples you already know about will be in the list returned. Check the moment of the property returned from `snouty runs events` against the moment in the examples or counterexamples you have already downloaded.

4. **Important:** Cross-reference the log against the source code of the system under test (SUT) and the workload if you have access to it.
5. Deeply investigate the failure to develop an understanding of the timeline of events which led up to and potentially caused it.
6. Report your findings.

**Important:** The property status and assertion text alone are not sufficient — the logs provide the actual runtime context needed to understand the failure.

### Diagnose incomplete run

If the "status" of a specific run is "incomplete", there may be an error log to examine. The steps to triage an "incomplete" status run:

1. Do a `snouty runs --json show ${RUN_ID}`
2. Look at the `failure_moment` structure in the returned JSON. If present, use the input_hash and vtime from `failure_moment` to download a log in accordance with the instructions in `references/logs.md`.
3. Try and obtain the build logs, especially if there is no failure moment, using `snouty runs --json build-logs ${RUN_ID}` and look for errors in the build.

> **Note on `links.triage_report`:** For incomplete runs, the per-property `properties` and `logs` endpoints typically return 404, but `links.triage_report` and `failure_moment` may still be populated in `show`. Report what `show` actually contains — do not claim the triage_report link is absent unless that field is null. The triage workflow for incomplete runs is `failure_moment` + `build-logs`, regardless of whether a report URL exists.

## General guidance

- **Review logs before concluding on failures.** When a failed property has examples with a moment supplied, download + analyze the logs before declaring a root cause. Some properties have no examples or logs — for those, the status alone is the evidence.
- **For property failures, consider the "details" section if provided.** These are curated fields supplied by the property author designed to illuminate the state of the system at the time of failure.
- **Present results clearly.** When reporting property statuses, use a table or list. When reporting log findings, include the virtual timestamp, source, container, and log text.

## Suggesting follow-up skills

End your triage summary with a short "next steps" section that names follow-up skills or additional triage workflows when they would help. Treat these as suggestions for the user, not actions to take automatically — let the user (or their orchestration) decide when to invoke them. If the user has explicitly asked to chain skills (e.g. "run triage and then debug any failing property"), follow their instructions and proceed with the chain.

Skills worth suggesting based on what triage uncovers:

- **`antithesis-research`** — map the codebase to surface better testable properties. Useful when failures point to systemic gaps in coverage rather than a discrete bug.
- **`antithesis-workload`** — extend or refine assertions, test commands, and logs. Should be suggested whenever all properties are passing to incrementally improve the workload, or when properties are not reachable due to the workload being underpowered. This skill can also be used to add more logging or fix properties to assist with root cause analysis.
- **`antithesis-debug`** — open the multiverse debugger on a specific failure to inspect container state at the failing moment or explore alternate histories. Useful when log analysis alone hasn't explained the failure. Requires agent-browser and may require interactive login in a browser.
- **`antithesis-query-logs`** — search across all timelines for ordering and causality questions ("did event A always precede failure B?", "do failures still occur without the preceding fault?"). Useful when a failure looks correlated with another event or fault, or when you've only inspected one history out of many. Requires agent-browser and may require interactive login in a browser.

Include the data the next skill will need (run_id, property name, moment, etc.) so the user can invoke it without re-discovering context.

## Self-Review

Before declaring this skill complete, review your work against the criteria below. This skill's output is conversational (summaries, tables, analysis), so the review should happen in your current context. Re-read the guidance in this file, then systematically check each item below against the answers and analysis you produced.

Review criteria:

- Every property status reported (passed, failed, unfound) was extracted from the actual properties fetch, not inferred or assumed
- Findings reference specific data from the properties data — property names, assertion text, log lines, timestamps
- Failed properties with available logs include actionable context: the assertion text, relevant log lines, and timeline context. Conclusions about failures are grounded in log evidence when logs exist
- The summary distinguishes between what the report shows and what you interpret or recommend
- If comparing runs, differences are grounded in data from both reports, not just one
