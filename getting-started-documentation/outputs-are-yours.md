# The Outputs Are Yours

When one of our skills produces something — a research document, a workload, a triage report — it goes into your repo. From that point on, it's yours. We don't try to lock you into a workflow; we try to compose with whatever workflow you bring. That puts some responsibility on you for how those outputs live and evolve.

## Compose with your workflow

We don't prescribe how you fit the skills into your work. We aim to be workflow-agnostic, working with whatever conventions you have, including "I don't have any." It's a balancing act.

The skills aren't a separate system you bolt on. They produce normal files in your repo. They go through your normal review process if you have one. They get tracked in whatever system you already use. There is no separate "Antithesis workflow" you need to adopt alongside what you already do.

That extends to the artifacts themselves. If a default output location doesn't match how your repo is organized, move it. If the structure of a research document doesn't fit your conventions, edit it. If the naming convention clashes with your existing files, rename things.

It also extends to the skills themselves. It's easy to think of a skill the way you'd think of a program: something opaque you invoke, that runs, that you can't change. Skills aren't that. A skill is text. Information loaded into the agent context to help it accomplish something. The process encoded in each of our skills is one way of doing the work, not *the* way. You can write your own skills that reference ours. You can lift parts of ours into your own. You can replace any of ours with your own.

Your harness is where adjustments like these live. It's the layer you build around the agent: project-level instructions, skills you write yourself, hooks that run automatically. [Building Your Harness](building-your-harness.md) covers the mechanics. Once a convention's in your harness, every future session inherits it. The skill is a starting point, not a finished system.

## Skills produce files in your repo

Our skills produce outputs. Research documents, workload definitions, triage reports. They have to live somewhere, and by default they live in your repo. That's a default we picked, not a requirement.

These are normal project files. You can version them, edit them, refactor them, delete them when they no longer apply. They aren't sacred. They aren't ours.

## Memory of what came before is your responsibility

Agents don't have memory. Each session starts from zero, with no recollection of what previous sessions did or learned. But research documents, triage reports, and workload definitions outlast the session that made them. That matters, because the next session benefits from what the last one knew.

A research document you generate today describes your system in a way you'll keep coming back to: weeks later, when a colleague joins, when something breaks, when you're deciding what to test next. A triage report names bugs you found, and bugs cluster. When the next failure shows up, knowing what you found and what you tried last time is what keeps you from re-investigating ground you've already covered. Without something carrying that context forward, every session starts back at square one.

The skills create some of these artifacts. You create more: notes about ongoing investigations, summaries of what was fixed and why, pointers to prior reports the next session should see.

We don't mandate how. Git history is a strong substrate: commit messages, PR descriptions, merged branches become a queryable record of what was decided and why. A CHANGES file works. A notes directory works. Markdown in your harness works. Pick whatever fits your existing patterns. None of this is required. Skipping it doesn't break anything. But the experience is meaningfully better when the agent can pick up where the last session left off.

## Research as a living document

Research describes your whole system: what's there, how it fits together, what's worth testing and why. Other outputs are narrower in scope. A triage report is about a specific failure at a specific moment. A workload definition is about a specific test setup. Research is the map of the territory.

That makes it the one most worth keeping current. A six-month-old research document describes a six-month-old system. Some things you tested then don't exist anymore. Some things you'd test now didn't exist when the research was written. The failure modes that mattered then aren't necessarily the ones that matter now.

An agent reading the old document forms an outdated picture of your system. It asserts properties that no longer apply, probes failure modes that no longer matter, suggests tests for code that's been refactored away.

Keep it current by re-running the skill when your system changes meaningfully, by editing the document directly as new things come up, or by some mix of the two. Running fresh after every change is one option, but it takes time and effort. Treating it as something you maintain by hand, with occasional re-runs, is often more practical. Pick the cadence that matches your project's pace of change.

The document is yours. How it evolves is up to you.
