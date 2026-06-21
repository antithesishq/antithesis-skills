---
name: "test:triage"
description: >
  This skill should be used when the user asks to "test the triage skill",
  "run triage tests", "validate antithesis triage", "test:triage", or
  "smoke test triage". Orchestrates end-to-end testing of the antithesis-triage
  skill by running real triage operations via sub-agents and reviewing the
  results for bugs, skill compliance issues, and papercuts.
---

# Test: Antithesis Triage Skill

End-to-end test harness for the `antithesis-triage` skill. Spawn sub-agents
that perform real triage operations against the live Antithesis API via
`snouty`, then review their work for issues.

**The top-level agent MUST NOT use the antithesis-triage skill directly.**
All triage operations happen inside sub-agents. The top-level agent only
orchestrates and reviews.

## Prerequisites

Before starting, verify the same prerequisites the triage skill requires:

```bash
which snouty && which jq && snouty --version
```

`snouty` must be at least version 0.6.0. Then confirm credentials with the canonical check (same as the triage skill's preflight):

```bash
snouty doctor
```

If any prerequisite is missing, out of date, or `snouty doctor` fails, stop and
report which ones are unavailable.

## Phase 1: Discover Runs

Spawn a **general-purpose sub-agent** with the Agent tool. Provide these
instructions, replacing `{{TENANT}}` with the actual value of the
`$ANTITHESIS_TENANT` environment variable and `{{TRIAGE_SKILL}}` with the
absolute path to `antithesis-triage/SKILL.md` in this repository. If
`$ANTITHESIS_TENANT` is empty in the current shell, ask the user for the tenant
name instead of aborting.

```
Read the skill file at {{TRIAGE_SKILL}} and follow its instructions to list
recent runs for the tenant "{{TENANT}}". Follow the "Summarize recent runs"
workflow.

Return the COMPLETE raw NDJSON of `snouty runs --json list -n 200` along
with a per-run summary that includes, for each run:
  - run_id
  - status
  - launcher
  - created_at / completed_at
  - antithesis.test_name and antithesis.description (from parameters)
  - whether links.triage_report is present (triageable yes/no)

Do NOT filter by status — return the full list so the orchestrator can
select targets across statuses.
```

Wait for this sub-agent to finish before proceeding.

If the sub-agent did not return the NDJSON list, abort.

## Phase 2: Select Test Targets

Read the sub-agent output. From the run listing, select two targets:

1. **Completed run with failing properties that have moments.**
   - `status == "completed"`
   - `links.triage_report` is present
   - At least one failing property with `counterexamples[0].moment.input_hash`
     present (i.e., addressable to a moment, not a telemetry/meta property)

   Confirm by calling `snouty runs --json properties --failing $RUN_ID` and
   verifying at least one entry has a counterexample with a `moment` field.

2. **Incomplete run with a failure_moment.**
   - `status == "incomplete"`
   - `links.triage_report` is present
   - `failure_moment` is present in `snouty runs --json show $RUN_ID`
   - Prefer runs whose duration (completed_at − created_at) is under 30
     minutes — these are usually setup/early-execution failures, which
     exercise the diagnose-incomplete path most directly

Rules for missing targets:

- If no completed run with failing-property moments exists, skip Phase 3a
  and note this in the final report.
- If no incomplete run with a `failure_moment` exists, skip Phase 3b and
  note this.
- If no runs exist at all, report that and stop.

## Phase 3: Triage Selected Runs

Spawn sub-agents **in parallel** for each available target. Do NOT instruct
sub-agents to report verbosely or tell them they are being tested — this
changes their behavior. The orchestrator will read their raw session traces
directly in Phase 4.

### Phase 3a: Completed run with failing properties

Spawn a general-purpose sub-agent with these instructions (substitute the
actual run id and `{{TRIAGE_SKILL}}` with the absolute path to
`antithesis-triage/SKILL.md` in this repository):

```
Read the skill file at {{TRIAGE_SKILL}} and follow its instructions to
triage the Antithesis run with run_id {{RUN_ID}}. Investigate the logs of
the failing property most likely to be a SUT bug. Pick any failing property
if you aren't sure. Do NOT explore or analyze any local source code
repositories — only use the snouty API and downloaded logs to perform your
triage.
```

### Phase 3b: Incomplete run

Spawn a general-purpose sub-agent with these instructions (substitute the
actual run id and `{{TRIAGE_SKILL}}` with the absolute path to
`antithesis-triage/SKILL.md` in this repository):

```
Read the skill file at {{TRIAGE_SKILL}} and follow its instructions to
triage the Antithesis run with run_id {{RUN_ID}}.
```

Wait for both sub-agents to complete.

## Phase 4: Review and Report

### Understanding the skill protocol

Before auditing the sub-agent traces, read the triage skill and its
references so you can distinguish correct behavior from violations:

1. Read `antithesis-triage/SKILL.md` — the main skill protocol
2. Read `antithesis-triage/references/run-discovery.md` — how runs are
   listed and selected
3. Read `antithesis-triage/references/run-info.md` — single-run metadata
4. Read `antithesis-triage/references/properties.md` — property triage
   workflow, including how counterexamples and moments map to log
   downloads
5. Read `antithesis-triage/references/logs.md` — log format and jq
   analysis patterns

Use these as the ground truth when evaluating compliance. If a sub-agent
does something that looks unusual, check whether the skill documents it
before flagging it as an issue.

### Reading sub-agent session traces

The Agent tool returns an `agentId` for each sub-agent (visible in the
result as `agentId: <id>`). Use the current session's ID and each agentId
to read the raw JSONL session traces:

```
~/.claude/projects/<project-dir>/<session-id>/subagents/agent-<agentId>.jsonl
```

To find the current session directory, look for the most recently modified
directory under `~/.claude/projects/` that contains a `subagents/` folder.

Extract all Bash tool calls from each sub-agent trace to see every command
and its output:

```bash
jq -c 'select(.type == "assistant") | .message.content[]?
  | select(.type == "tool_use" and .name == "Bash") | .input.command' \
  <trace-file>.jsonl
```

Extract tool results to see command outputs:

```bash
jq -c 'select(.type == "user") | .message.content[]?
  | select(.type == "tool_result") | {tool_use_id, content: .content[:500]}' \
  <trace-file>.jsonl
```

This gives you the complete record of what each sub-agent did — every
snouty invocation, every jq query, every script run, every error — without
relying on their summaries.

### What to look for

Scan the raw traces for issues in these categories:

**Bugs** — things that are broken:

- `snouty runs` invocations that fail with non-timeout errors (404, schema
  mismatch, unexpected exit codes)
- `download-logs.sh` or `process-logs.py` failures
- `jq` queries that error out or return null where data should exist
- The chunked-download fallback (`download-logs-chunked.py`) triggering
  and then itself failing
- Skill-documented commands that do not behave as the skill claims

**Compliance violations** — the sub-agent did not follow the skill
protocol:

- Reaching for the web UI / agent-browser / `curl` against the report URL
  when `snouty runs` exposes the data
- Skipping the `snouty runs --json show` step before triaging
- Triaging a run with no `links.triage_report` without first reporting
  that the run is not triageable
- Rounding or reformatting `input_hash` / `vtime` before passing them to
  `snouty runs logs` or `download-logs.sh` (the skill requires verbatim
  values)
- Concluding root cause for a property failure without downloading and
  inspecting the corresponding log when a moment is available
- Treating a telemetry/meta property counterexample (non-`moment`
  payload, e.g. a scalar or session-id object) as if it had a moment and
  trying to download logs for it

**Inefficiencies** — things that work but waste time or tokens:

- Downloading the same log file repeatedly to the same path
- Fetching all properties without `--failing`/`--passing` filters when
  only one side is needed
- Reading large logs into the context window instead of running jq
  filters against them
- Steps that required multiple retries (especially >2 retries for the
  same operation), which usually indicates unclear instructions in the
  skill

Do **not** flag repeated `snouty runs` invocations against the same run/endpoint
as an inefficiency. `snouty` handles caching for repeated calls, so re-issuing
the same `snouty runs` call (e.g. `properties`, `show`, `build-logs`) at
different jq depths or filters is fine and is not a sign of a skill problem.

## Output Format

Produce a concise report focused on **actionable issues only**. Do not
include sections about what went well, generic suggestions, or broad
recommendations. The goal is clear signal on breakage and inefficiency.

### Test Summary

- Tenant tested
- Runs selected (run_id, status, failing-property counts where applicable)
- Sub-agents spawned (include agentIds)
- Any skipped phases and why

### Issues

For each issue found, include:

- **Severity**: Bug / Compliance / Inefficiency
- **Phase**: Which phase the issue occurred in
- **Description**: What happened
- **Evidence**: Exact commands and outputs from the session trace (quote
  directly)
- **Fix**: Concrete change to make (file + what to change)

Sort by severity (bugs first, then compliance, then inefficiency).

If no issues are found, report "No issues found" — do not pad the report.
