# The Outputs Are Yours

When one of our skills produces something — a research document, a workload, a triage report — it goes into your repo. From that point on, it's yours. We don't try to lock you into a workflow; we try to compose with whatever workflow you bring. That puts some responsibility on you for how those outputs live and evolve.

## Skills produce files in your repo

Antithesis skills generate artifacts that live in your project, not in our system. The research skill writes a document to your repo. The workload skill produces a workload definition. Triage produces reports. These are normal project files — you version them, edit them, refactor them, delete them when they no longer apply.

They aren't sacred. They aren't ours. Treat them with the same care you'd give any other artifact you author.

## Memory of what came before is your responsibility

The skills don't carry memory across sessions on their own. If a past triage found a bug and you fixed it, the next triage session doesn't automatically know that. You need to give it that memory in some form — by pointing it at the prior report, by writing a note into your harness, by leaving a summary the next session can find.

Git history is a strong substrate for this. Commit messages, PR descriptions, and merged branches become a queryable record of what was decided and why. Whatever form you use, the responsibility for "what we've already learned" is yours, and the skills will work better when you've made that history accessible.

## Research as a living document

The research skill produces a document describing your system's testing landscape. That document is most useful as a *living* thing — you re-run the skill when your system changes meaningfully, or you edit the document directly as new things are learned.

Running it fresh after every change is one option but it takes time and effort. Treating it as something you maintain by hand, with occasional re-runs, is often more practical. Pick the cadence that matches your project's pace of change. The output is yours; you decide how it evolves.

## Compose with your workflow

We don't prescribe how you integrate the skills into your team's work. You decide whether outputs get committed to main, kept on a branch, reviewed in PRs, tracked in your issue system, or handled some other way. The skills are designed to plug into whatever conventions you already have.

If a default output location or format doesn't fit your workflow, change it. The skill is a starting point, not a finished system.
