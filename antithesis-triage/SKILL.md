---
name: antithesis-triage
description: >
  Triage Antithesis test reports to understand what happened in a run: look
  up runs, check status, investigate failed properties (assertions), view
  metadata, download logs, inspect findings, and examine environmental
  details. Load after a run completes or when investigating a failure.
compatibility: Requires snouty (https://github.com/antithesishq/snouty), and jq.
metadata:
  version: "2026-05-06 079e8bd"
---

# Antithesis Run Triage

Use this skill to analyze Antithesis test runs.

**Reference files:** This skill's `references/` directory contains detailed guides for specific tasks. Do NOT read them all up front — only read a reference file when you are told to. Each reference file is mentioned by name at the point where it is needed.

## Prerequisites

- DO NOT PROCEED if `snouty` is not installed. See `https://raw.githubusercontent.com/antithesishq/snouty/refs/heads/main/README.md` for installation options.
- DO NOT PROCEED if `snouty` is not at least version 0.4.0. Use `snouty --version` to find the version.
- DO NOT PROCEED if `jq` is not installed. See `https://jqlang.org/download/` for installation options.

## Gathering user input

Before starting, collect the following from the user:

1. **Tenant Name** (required) — You must know the tenant name. Check the `$ANTITHESIS_TENANT` environment variable. Ask the user if you do not have evidence for the tenant name.

2. **What they want to know** — Are they interested in all failures in a specific run? Are they investigating a specific failure?  Are they getting a general overview? Comparing runs? This determines which workflow to follow.


## How to get information from a run

Your main method to obtain information is to use the `snouty runs <OPTION>` command with the `--json` option. The `--json` option returns line-delimited json. The fields in the json depend on the option you are using. The same command without the `--json` returns fewer fields and in a tabular form. It is more suited for human beings to use.  

You will need to know the RUN_ID. Read `references/run-discovery.md` to learn how to obtain the run_id. 


## Workflows

### Summarize recent runs

Read `references/run-discovery.md` to get a list of recent runs. Then summarize them in a report.

### Looking up a specific run

To lookup a specific run (report), read `references/run-info.md`. Then continue with other workflows as needed.

### Diagnose failed run

If the "status" of a specific run is "failed" and the "links"."triage_report" value is specified, there is likely an error log in the triage report. Visit the triage report and read it as an error log page.

### Triage a run

1. Read `references/run-info.md` to load information on a run
2. Read `references/properties.md` to load properties
3. Review passed/failed counts
4. Build a detailed summary of the run including a review of all failures as well as flagging any new failures.

### Investigate failed properties

1. Read `references/properties.md` - use `snouty runs --json properties` to extract properties with their examples 
   and learn how to download logs
2. Read `references/logs.md` to learn how to understand logs
3. For each property to investigate:
   a. Pick the first failing example
   b. Find the moment 
   c. Download the example's log using `snouty runs --json logs $RUN_ID $INPUT_HASH $VTIME`. Make sure vtime does not get rounded. Input has and vtime should match exactly what is contained in the example's `moment` structure
   d. Analyze the downloaded log locally
   e. If you aren't certain what caused the issue, consider downloading another example's log from the same property. Passing logs can be useful to compare against.
4. Cross-reference the log against the source code of the system under test (SUT) if you have access to it.
5. Deeply investigate the failure to develop an understanding of the timeline of events which led up to and potentially caused it.
6. Report your findings.

**Important:** Make sure you download and review example logs and the source code of the SUT if you have access to it. The property status and assertion text alone are not sufficient — the logs provide the actual runtime context needed to understand the failure.

### Verify cascade vs independent failures

When you suspect a failure might be a cascade from an earlier failure (e.g.,
property X always fails after property Y), do not rely on a handful of
examples from the triage report. A few examples can mislead — use the
`antithesis-query-logs` skill to test the hypothesis across all timelines:

1. Use `antithesis-query-logs` to count total failures of the target property
2. Run a temporal query ("not preceded by" the suspected upstream failure)
3. Compare counts: if the count drops, the difference is cascade failures;
   if it stays the same, the failures are independent
4. Report the actual numbers — e.g., "53 total failures, 53 remain after
   filtering out upstream-X → failures are independent" or "53 total, 7
   remain → 46 are cascades from upstream-X"

Do not generalize from a small sample. If you inspect 2-3 examples in the
triage log viewer and they all show the same upstream failure, that does not
mean all instances are cascades. The temporal query gives you the true count.

## General guidance

- **Download log files for local analysis.** Whenever possible try to download log files locally rather than using the web-ui log viewer.
- **Review logs before concluding on failures.** When a failed property has examples with a moment supplied, download + analyze the logs before declaring a root cause. Some properties have no examples or logs — for those, the status alone is the evidence.
- ****For property failures, consider the "details" section if provided.** These are curated fields supplied by the property
author designed to illuminate the failure.
- **Consider Multiverse debugging.** You may propose an antithesis Multiverse Debugging (MVD) session when the evidence warrants it — MVD lets you time-travel to any moment in a log event's history and run commands against the system as of that moment. Hand off to a debugging skill; its setup reference describes the launch protocol, which currently depends on whether the installed `snouty debug` accepts a `run_id` directly or only a `session_id` (in which case the user starts the session and pastes the URL). Before launching, have a plan for the commands and hypotheses you want to examine. See the antithesis documentation for what an MVD session can do.
- **Prove cascade hypotheses with log queries, not samples.** If you suspect a failure is a cascade from an earlier failure, use the `antithesis-query-logs` skill's temporal queries to determine the true scope. Do not conclude from a few triage examples — the Logs Explorer searches all timelines and gives exact counts.
- **Present results clearly.** When reporting property statuses, use a table or list. When reporting log findings, include the virtual timestamp, source, container, and log text.

## Self-Review

Before declaring this skill complete, review your work against the criteria below. This skill's output is conversational (summaries, tables, analysis), so the review should happen in your current context. Re-read the guidance in this file, then systematically check each item below against the answers and analysis you produced.

Review criteria:

- Every property status reported (passed, failed, unfound) was extracted from the actual properties fetch, not inferred or assumed
- Findings reference specific data from the properties data — property names, assertion text, log lines, timestamps
- Failed properties with available logs include actionable context: the assertion text, relevant log lines, and timeline context. Conclusions about failures are grounded in log evidence when logs exist
- The summary distinguishes between what the report shows and what you interpret or recommend
- If comparing runs, differences are grounded in data from both reports, not just one
