# Investigating Open Questions

## Goal

Resolve every open question in the selected properties' evidence files by
reading the actual code. After investigation, no question should remain
unanswered for properties being refined.

## Approach

Spawn one agent per property that has open questions. Properties without open
questions skip this step. Run all agents in parallel.

Each agent receives:

- The property's evidence file (`antithesis/scratchbook/properties/{slug}.md`)
- Access to the codebase
- These instructions:

> Read the evidence file for this property. Identify all open questions — these
> are typically marked as questions, flagged with "need to verify," or phrased
> as uncertainties about code behavior.
>
> For each question, the evidence file should explain why the question matters
> and what the answer changes. Start from that context. Read the specific code
> paths mentioned in the evidence to answer the question definitively.
>
> After investigating all questions, return:
>
> 1. For each question: the answer, the code evidence that supports it, and how
>    it affects the property (does it confirm the property as stated, require
>    changes to the invariant or assertion type, change the instrumentation
>    approach, or invalidate the property entirely?)
> 2. An updated version of the evidence file with questions resolved — replace
>    each question with the answer and its implications. Preserve all existing
>    content that is still accurate. If the answer changes the property
>    fundamentally, update the relevant sections (failure scenario, assertion
>    type rationale, instrumentation points).
> 3. If the property is invalidated by what you find, say so clearly and explain
>    why. It will be marked as invalidated in the property catalog.

## After Investigation

Once all agents return:

- Write the updated evidence files to the scratchbook, replacing the originals
- Record any properties that were invalidated, with the reasoning
- If an answer in one property has implications for another property in the
  selection (e.g., a shared code path behaves differently than expected), note
  this for the dominance resolution step

## What Makes a Good Investigation

- **Answer from code, not reasoning.** The question exists because research
  couldn't determine the answer from code analysis alone. The investigator must
  read the actual code and report what it does, not what it should do.
- **Preserve the evidence file's voice.** The updated file should read as a
  coherent document, not as an original document with patches bolted on.
  Integrate the answers naturally.
- **Flag surprises.** If the investigation reveals something unexpected beyond
  the specific question — a related bug, a missing error path, a contradiction
  between code and documentation — include it in the updated evidence file.
  These findings may produce new properties or change existing ones.
