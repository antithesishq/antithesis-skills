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
that perform real triage operations, then review their work for issues.

**The top-level agent MUST NOT use the antithesis-triage skill directly.**
All triage operations happen inside sub-agents. The top-level agent only
orchestrates and reviews.

## Prerequisites

Before starting, verify the same prerequisites the triage skill requires:

```bash
which snouty && which agent-browser && which jq
```

Also confirm `ANTITHESIS_TENANT` is set:

```bash
echo "$ANTITHESIS_TENANT"
```

If any prerequisite is missing, stop and report which ones are unavailable.

## Phase 1: Discover Runs

Spawn a **general-purpose sub-agent** with the Agent tool. Provide these
instructions, replacing `{{TENANT}}` with the actual value of the
`$ANTITHESIS_TENANT` environment variable and `{{TRIAGE_SKILL}}` with the
absolute path to `antithesis-triage/SKILL.md` in this repository:

```
Read the skill file at {{TRIAGE_SKILL}} and follow its instructions to list
recent runs for the tenant "{{TENANT}}". Follow the "Summarize recent runs"
workflow.

Fetch recent complete and incomplete runs separately by using the status filter:

  `window.__antithesisTriage.runs.getRecentRuns({status: 'Completed'})`
  `window.__antithesisTriage.runs.getRecentRuns({status: 'Incomplete'})`

Return the COMPLETE results from both calls in JSON, including for each run:
  - name
  - status (completed/in-progress/error)
  - findings counts by category (new, ongoing, resolved, rare)
  - triage URL (or null if unavailable)
  - utilization info
```

Wait for this sub-agent to finish before proceeding.

If the sub-agent did not return triage URLs abort.

## Phase 2: Select Test Targets

Read the sub-agent output. From the run listing, select two runs:

1. **Completed run with findings** — Status is completed, has at least one
   finding in any category (new, ongoing, resolved, rare), and has a non-null
   `triageUrl`. Prefer runs with `new` or `ongoing` findings.

2. **Incomplete or no-findings run** — Either a run still in progress (null
   `triageUrl`) OR a completed run with zero findings across all categories. Pick an incomplete run that finished in less than 15 minutes to maximize the chance that it's a setup incomplete run.

Rules for missing targets:

- If no completed-with-findings run exists, skip Phase 3a and note this in
  the final report.
- If no incomplete/no-findings run exists, skip Phase 3b and note this.
- If no runs exist at all, report that and stop.

## Phase 3: Triage Selected Runs

Spawn sub-agents **in parallel** for each available target. Do NOT instruct
sub-agents to report verbosely or tell them they are being tested — this
changes their behavior. The orchestrator will read their raw session traces
directly in Phase 4.

### Phase 3a: Completed run with findings

Spawn a general-purpose sub-agent with these instructions (substitute the
actual triage URL and `{{TRIAGE_SKILL}}` with the absolute path to
`antithesis-triage/SKILL.md` in this repository):

```
Read the skill file at {{TRIAGE_SKILL}} and follow its instructions to triage
the Antithesis report at {{TRIAGE_URL}}. Investigate the logs of failing
property most likely to be a SUT bug. Pick any failing property if you aren't
sure.
```

### Phase 3b: Incomplete or no-findings run

Spawn a general-purpose sub-agent with these instructions (substitute the
actual URL and `{{TRIAGE_SKILL}}` with the absolute path to
`antithesis-triage/SKILL.md` in this repository):

```
Read the skill file at {{TRIAGE_SKILL}} and follow its instructions to triage
the Antithesis run at {{TARGET_URL}}.
```

Wait for both sub-agents to complete.

## Phase 4: Review and Report

### Reading sub-agent session traces

The Agent tool returns an `agentId` for each sub-agent (visible in the
result as `agentId: <id>`). Use the current session's ID and each agentId
to read the raw JSONL session traces:

```
~/.claude/projects/<project-dir>/<session-id>/subagents/agent-<agentId>.jsonl
```

To find the current session directory:

```bash
ls -td ~/.claude/projects/*/$(basename $(ls -t ~/.claude/projects/*/*.jsonl | head -1 | xargs dirname))/ 2>/dev/null | head -1
```

Or more reliably, look for the most recently modified session directory that
contains a `subagents/` folder.

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
navigation, every runtime injection, every eval call, every error — without
relying on their summaries.

### What to look for

Scan the raw traces for issues in these categories:

**Bugs** — things that are broken:

- Runtime method failures (unexpected errors from `window.__antithesisTriage.*`)
- Navigation breakage (wrong page, redirect loops, auth failures)
- JavaScript errors or missing methods
- Data extraction failures (empty results when data exists, malformed JSON)
- Script failures (`download-logs.sh`, `process-logs.py`)

**Compliance violations** — the sub-agent did not follow the skill protocol:

- Missing runtime injection after navigation
- Missing `--session-name antithesis` for cookie persistence
- Missing `networkidle` wait before injecting the runtime
- Missing `waitForReady()` before querying page data
- Forgot to close browser session when done
- Ran `agent-browser` calls in parallel

**Inefficiencies** — things that work but waste time or tokens:

- Steps that required multiple retries (especially >2 retries for the same operation)
- Unnecessary repeated navigations or runtime re-injections
- Excessive screenshot-based debugging when eval methods exist
- Commands that consistently fail before succeeding (indicates unclear instructions)

## Output Format

Produce a concise report focused on **actionable issues only**. Do not
include sections about what went well, generic suggestions, or broad
recommendations. The goal is clear signal on breakage and inefficiency.

### Test Summary

- Tenant tested
- Runs selected (names, status, findings counts)
- Sub-agents spawned (include agentIds)
- Any skipped phases and why

### Issues

For each issue found, include:

- **Severity**: Bug / Compliance / Inefficiency
- **Phase**: Which phase the issue occurred in
- **Description**: What happened
- **Evidence**: Exact commands and outputs from the session trace (quote directly)
- **Fix**: Concrete change to make (file + what to change)

Sort by severity (bugs first, then compliance, then inefficiency).

If no issues are found, report "No issues found" — do not pad the report.
