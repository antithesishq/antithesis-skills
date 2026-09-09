---
name: antithesis-evaluate-inputs
description: >
  Evaluate a workload's input generation for state space exploration: how well
  it uses randomness to drive the system under test into diverse regions of
  behavior.
metadata:
  version: "0.0.0"
---

# Antithesis Evaluate Inputs

## Purpose and Goal

Examine a workload and report how well its input generation explores state
space. The system under test is a black box — the evaluation works entirely
from the workload code and any documentation the user provides.

This skill is read-only. It produces a report of findings. It does not modify
the workload, open PRs, or suggest specific code changes.

The framing is "untapped exploration" — findings are ceilings on what the
workload can reach, not defects. A workload exhibiting any anti-pattern may
still be productive. The question is whether it could reach more interesting
behavior with structural changes to how it uses randomness.

## When to Use

When a user isn't finding bugs and wants to understand whether the workload's
input generation is limiting what Antithesis can explore. Also useful as a
periodic health check on workloads — both human-written and agent-generated.

## Core Principle

Randomize the *policy* per run, not just the *choices under a fixed policy*.
Each run should explore a different region of behavior by biasing its
configuration differently. The skill evaluates how well the workload does
this.

## Workflow

### 1. Locate the workload

Find the test commands and workload code. Common locations:

- `antithesis/test/` — test command scripts
- Workload source files referenced by test commands
- Client libraries or helpers used by the workload

If the workload location isn't obvious, ask the user.

### 2. Read the anti-patterns reference

Read `references/anti-patterns.md` before examining the workload. It contains
the full catalog of input generation anti-patterns organized by category, with
explanations of why each limits exploration and what better looks like.

### 3. Examine the workload

Read the workload code and look for structural patterns that match the
anti-patterns. Focus on what is visible in the code:

**Action selection** — How are operations chosen?
- Is there a fixed set that's always fully active, or per-run subsetting?
- Are action weights fixed, uniform, or varied per-run?
- Is ordering imposed by the harness or emergent from randomness?
- Are there symmetric pairs always active together?

**Data generation** — How are inputs produced?
- Are values hardcoded, drawn from fixed pools, or generated?
- Do ranges vary per-run, or are bounds hardcoded?
- Does input quality vary (valid, invalid, mixed), or is it always valid?
- Do payload sizes span orders of magnitude, or stay in a narrow band?

**Structure** — How is the workload organized?
- Is the concurrency level fixed or varied per-run?
- Does operation pacing vary, or is it always steady/fast?
- Does the workload always start from empty state?

### 4. Build the findings

For each anti-pattern you identify in the workload:

- Name the pattern
- Point to where in the code you see it (file and line)
- Explain what state space it leaves unexplored
- Describe what the workload could reach if this changed

The explanation should be concrete and specific to this workload, not a
generic restatement of the anti-pattern. "Your three actions (put, get,
delete) are always all active with equal weight — runs where only deletes
fire would test behavior with zero keys" is better than "all actions are
always active."

### 5. Tier the findings

Not all findings deserve equal weight. Tier them:

- **High signal** — The workload has a clear structural limitation that
  prevents it from reaching entire regions of state space. Example: all
  actions always active with no subsetting, all values hardcoded.
- **Worth considering** — The workload could explore more space with changes,
  but the limitation is more contextual or less severe. Example: no
  null/absent value variation, fixed concurrency level.
- **Observation** — Something the examiner noticed that might matter depending
  on the system. Example: encoding variation, seed data identical across runs.

When you can't assess a finding's severity without domain knowledge (e.g.,
"this range is hardcoded, but I don't know what the system accepts"), say so.
Present the structural fact and let the user supply the domain judgment.

### 6. Present the report

Structure the report as:

1. **What the workload does** — A brief summary of what the examiner sees:
   what actions the workload takes, how it generates data, how it's
   structured. This is the examiner's model of the workload, presented so the
   user can correct misunderstandings before reading findings.

2. **Findings** — Organized by tier (high signal first), grouped by category
   when multiple findings cluster. Each finding names the pattern, points to
   the code, and explains the unexplored state space in terms specific to this
   workload.

3. **What's working well** — Patterns the workload already does right. If the
   workload has per-run action subsetting, or varies payload sizes, say so.
   Findings-only reports feel like a critique; acknowledging what works frames
   the report as an assessment.

## Tone

The report must read as "here's what you could explore that you're not
reaching" — never as "your workload is bad." A workload exhibiting multiple
anti-patterns may still be finding bugs; the goal is to help it find more.

Don't frame findings as "you need to do this." Frame them as "this is state
space you're not reaching, and here's what reaching it would look like." The
user decides what's worth changing.

## Scope Boundaries

This skill evaluates **input generation** — how the workload drives the
system into diverse states. It does not evaluate:

- **Assertion quality** — Whether the workload would notice a bug if it
  reached one. That's a separate concern.
- **System correctness** — Whether the system under test is behaving
  correctly. The SUT is a black box.
- **Workload correctness** — Whether the workload code has bugs. The examiner
  reads the workload's structure, not its correctness.
- **Infrastructure** — Whether the Antithesis setup, Docker configuration, or
  test templates are correct.

If the examiner notices something outside its scope that seems important
(e.g., the workload has no assertions at all), it can mention it briefly as
an observation, but should not evaluate it in depth.

## Reference Files

| Reference               | When to read                                        |
| ----------------------- | --------------------------------------------------- |
| `references/anti-patterns.md` | Before examining any workload — the full catalog |
