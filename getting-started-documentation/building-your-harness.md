# Building Your Harness

Your harness is what you put around an agent to make it useful for your project: AGENTS.md or CLAUDE.md, the skills you write or install, hooks that run automatically, rubrics you want the agent to follow. An agent comes general. Your harness makes it specific.

You'll build your harness over time. Day one, you'll have nothing. Every time you correct the agent on something, every time you find yourself explaining the same thing twice, every time you wish a check happened automatically: put it in the harness. Once it's in, it sticks. Over time, you'll have a harness that fits your project.

A lot of what you'll add to your harness over time is skills.

## Skills

Skills are commands in your agent: /antithesis-research, /antithesis-triage, /antithesis-workload. You invoke one, the agent does the thing. It looks like that's all there is to using them: invoke, get result, take what you get.

There's more. A skill is information loaded into the agent's context for a particular kind of task. It's text in your filesystem, in markdown files you can open and read.

That changes how you can use them. The default is to run a skill as-is: invoke it, the agent loads the text, the agent follows it. Most of the time that's exactly what you want. But it isn't the only way to work with them.

You can take parts of a skill and use them in your own. Open the file. Copy what's useful. Use it in a skill you write.

You can also use a skill outside what it was "designed for." Tell the agent to use the information from one skill for a task it wasn't "built around."

> Using the analysis in antithesis-research, walk me through how requests flow when service A is down.

> Looking at the failure modes catalogued in antithesis-research, where would be the riskiest place to introduce a code change next quarter?

> Using the architecture analysis from antithesis-research, draft a one-pager I can share at next week's design review.

> Make me a tutorial for my colleagues. Pull from antithesis-documentation and the other antithesis skills I have installed. Start with how Antithesis works, build up to good testing practices. Use our software as analyzed by antithesis-research for the worked example.

The skill becomes context for whatever task you've got, not a fixed path you have to follow.

## What the harness is for

Agents lack taste. They've absorbed an enormous amount of code, but not the *whys* that led to those outputs. And the whys are what decide whether code is good. Good is partly intrinsic, mostly extrinsic: it depends on the system the code lives in, the constraints it has to satisfy, the trade-offs that were made. With the outputs but not the whys, agents produce code that looks correct without knowing whether it's appropriate. They cargo-cult patterns from elsewhere and don't probe for the constraints you're actually under: what the system needs to guarantee, what trade-offs you've already made, what failure modes you care about. Left to themselves, they build on whatever local context happens to fit, and over time that adds up to fragility.

Architecture and design are still human work. The agent is a strong collaborator on implementation; it's a much weaker one on architecture. Your job is to inject the taste and domain knowledge it doesn't have. This is part of what the harness is for: the constraints, the conventions, the system's shape — encoded in your harness instead of held in your head and explained each session.

Surfacing what's there to encode is its own task. When you're about to start something substantial, ask the agent up front:

> Before we touch the code, let's talk about the constraints. What does this need to guarantee? What trade-offs have already been made? What are we trying to avoid?

Anything from that conversation you'd repeat across sessions belongs in your harness. The question is where it goes.

## Standing instructions

Agentic tools read instruction files. CLAUDE.md for Claude Code, AGENTS.md for Codex. The agent loads them automatically at the start of every session. Whatever you put in them is in its context before it does anything.

You can have these files at more than one level. A global file in your home directory applies to every session, in every project. A file at the root of a project applies to every session in that project. A file in a subdirectory applies when the agent is working in that subdirectory.

Loading is additive. When you start a session and ask the agent to work somewhere, it pulls in your global file, the project's root file, and any subdirectory files that match where it's working. All of those contribute to the context the agent uses.

Use the levels. Your global file is for principles and preferences you always want applied: code design rules, working-style preferences, things you never want the agent to do without asking. The project's root file is for conventions and facts about that specific project: its build commands, the directory layout, terms with specific meanings, things that differ from your usual habits. Subdirectory files refine that further when one part of your codebase has different rules.

A global AGENTS.md might say:

> Prefer explicit error handling over silent failures.
> Don't make changes to my git history without asking.
> When in doubt about scope, ask before acting.

A project-root AGENTS.md might say:

> Build with `make`. Tests run with `make test`.
> All Antithesis-specific code lives under `antithesis/`. See `antithesis/AGENTS.md` for that directory's conventions.
> "Workload" refers to the test workload we send to Antithesis, not generic "work."

This is where to start building your harness. Put things in proactively when you know you want them applied. Put things in reactively when you find yourself repeating a correction.

Each AGENTS.md is scoped to a location: global, project, or subdirectory. Within its scope, the agent always loads it. Some things don't fit any of those scopes.

Take a deploy procedure. It's not universal: it's specific to this project. It's not tied to a single directory: deploy work might touch the whole repo. And it's not always relevant: you only deploy occasionally. Putting it in the project-root AGENTS.md would mean loading it every session: when you're writing tests, when you're refactoring, when you're triaging bugs. Most of the time it's noise.

Things like that belong in a skill. Your release flow, your incident response, anything tied to a particular task lives in skills, not in AGENTS.md.

## Writing your own skills

Writing your own skills is easier than people expect. They're "just" text files. Markdown that lives on your machine and that the agent reads. Nothing more.

People sometimes look at a skill, see how much instruction is in it, and assume writing one is a big undertaking. It doesn't have to be. The agent can help you write skills. Walk through what you want it to know. Ask it to draft the skill. Read what it gives you. Adjust where it got things wrong. That's most of writing a skill.

Where you save the file determines who can use it. For your own work (debug workflows you've developed, shortcuts you've built), the skill lives in your home directory. In Claude Code that's `~/.claude/skills/`; other tools have similar conventions, check the docs. It's available to you in any project on the same machine.

For a project's work (deploy procedures, release flows, incident runbooks, anything the team should do consistently), the skill lives in the project. Claude Code looks for project skills in `.claude/skills/` at the project root; other tools have similar conventions, check the docs. Commit it. Now anyone who clones the repo has the skill. Project skills are how harness content becomes shareable across a team.

A skill has a few core parts: a name, a description that tells the agent when to use it, and the instructions themselves. The Claude Code or Codex docs cover the exact format your tool expects.

The first version is rarely the last. As you use the skill, things turn up: steps that need clarifying, edge cases not covered, parts that aren't relevant after all. Update the skill. Over a few uses you'll know whether it's pulling its weight.

Skills also tame variation. Some procedures need to be done the same way every time: your release process, your migration procedure, anything where a missed or out-of-order step causes real damage. The agent left alone isn't fully consistent across sessions. Even with the same prompt it might do things slightly differently. A skill removes that. The text becomes the spec.

The best way to learn what good skills look like is to read ones other people wrote. Ours are open at [github.com/antithesishq/antithesis-skills](https://github.com/antithesishq/antithesis-skills). Read them. Lift parts into your own. Write your own that reference ours: invoke /antithesis-research as part of a bigger flow. Fork ours and pull updates periodically. Or use ours as inspiration and write something entirely your own.

## Hooks

Some agentic tools support hooks: scripts that fire automatically when certain events happen during the agent's work. A pre-tool hook fires before the agent invokes a particular tool. A post-edit hook fires after the agent edits a file. A session-start hook fires when a new session begins.

Hooks are different from AGENTS.md and skills. Both of those are context the agent reads. The agent might act on what they say. It might not. LLMs are non-deterministic. An instruction in your AGENTS.md is something the agent should follow but isn't guaranteed to. A skill is something the agent should follow once invoked but again, isn't guaranteed to apply every step exactly.

Hooks don't have that problem. When the trigger event fires, the script runs. Every time. Whether the agent wanted it to or not. That makes hooks the right choice for things you can't tolerate the agent skipping.

What can you actually do with hooks? Here's a sample of what people use them for:

- **Block bad commits.** A hook that runs before the agent commits, executing your test suite, your linter, your type checker first. If anything fails, the commit doesn't happen. The agent can't talk itself past a hook.
- **Refuse destructive operations.** A hook that fires before shell commands run and scans for `rm -rf`, `git push --force` to main, `DROP TABLE`, anything irreversible. Block it or require explicit confirmation.
- **Protect sensitive files.** A hook that fires before file edits and blocks them on specific paths: production config, credentials, generated code. The agent can read them but can't modify them.
- **Inject context automatically.** A hook that fires at session start, runs `git status`, and injects the result into the agent's context, so it always knows what's uncommitted, what branch it's on, what state the working tree is in.
- **Run formatters after edits.** A hook that runs after each file edit and applies Prettier, gofmt, rustfmt, whatever's appropriate. The code is consistent without the agent having to remember.
- **Catch secrets before they leak.** A hook that runs before commits and scans for API keys, tokens, and credentials. The agent might not recognize what shouldn't go into a commit. The hook does.
- **Log what the agent did.** A hook that runs after each tool use and records every shell command run, every file touched. Useful for after-the-fact review, debugging, or auditing.
- **Warn about dangerous context.** A hook that fires at session start, checks if you're on the main branch, and warns you (or refuses to start a session there). Cheap way to keep accidental edits from landing.

Claude Code's hook system has events for moments like these: before a tool runs, after a tool runs, before a prompt is submitted, at session start, when the agent stops. Other tools have similar hooks under different names. Your agent's docs cover what events its hooks can attach to.

Hooks take more setup than a line in AGENTS.md. You're writing a script, choosing an event to attach it to, deciding what triggers a block. That cost is real, but for any rule you absolutely require, it buys you certainty. For everything else, AGENTS.md and skills are lighter weight.

## Hand the agent its own rubric

By now you've seen the components of a harness: AGENTS.md for what's always on, skills for task-specific work, hooks for what must happen, the capture-what-you-learn loop for keeping it growing. One of the most important things you can put into any of those is a rubric: your taste, written down.

Agents have no taste. The "What the harness is for" section made this point: they've absorbed an enormous amount of code without absorbing the *whys* that decided which examples were any good. Without taste, they produce code that looks right but isn't appropriate. They cargo-cult patterns from elsewhere. They build whatever fits the local context.

A rubric is the explicit version of taste. The principles you'd want any engineer working on your code to apply: error handling patterns, architectural preferences, style choices that aren't enforced by tools, the things you find yourself correcting people on. It's what you'd teach a new colleague over a few weeks of code review, written out so an agent can read it directly.

Agents are good at following an explicit rubric. They're bad at inferring one from your reactions across a session. If you correct the agent for leaving dead code behind, the fix might stick for the rest of the session. Next session, the same agent makes the same mistake. You haven't taught it your taste. You've just course-corrected, again.

What goes in a rubric? Taste calls. Things you want applied that your tools can't enforce. Patterns you find yourself correcting repeatedly. Examples:

- "Prefer explicit error handling over silent failures."
- "Don't add features, refactor, or introduce abstractions beyond what the task requires."
- "Default to writing no comments. Only add one when the why is non-obvious."
- "When you remove code, remove the tests for it too."
- "Match the existing code style; don't restyle code you're modifying."

These aren't facts about your project. They're judgments about what makes code worth shipping. Each one is what a careful reviewer would call out, written down so the agent applies it before a reviewer has to.

Where the rubric lives depends on scope. Principles for all your work go in your global AGENTS.md. Project-specific principles go in the project's AGENTS.md. For principles that only matter for specific kinds of work, a separate file the agent reads on demand works better: "Apply the principles in PRINCIPLES.md to this change."

Writing a rubric is harder than writing standing instructions, because it requires knowing what you care about. The first version will be short. As you work, you'll notice yourself reacting to the agent's output: "no, not like that" / "I'd never write it that way." Each of those reactions is a candidate for the rubric. The capture-what-you-learn loop is where the rubric grows.

Your rubric does work everything else doesn't. AGENTS.md tells the agent what's true. Skills tell the agent how to do specific tasks. Hooks tell the agent what it can't get away with. The rubric tells the agent what good looks like. That shapes every line of code it writes.

## Capture what you learn

Your harness grows from what you notice while you work. Things you'd correct again. Decisions you reached. Conventions that emerged. The annoying tendencies that came up twice. If you don't capture them, they get lost.

When the agent does something you don't like, don't just correct it and move on. Ask it why.

> Why did you do it this way?

The answer is often useful. Sometimes the agent reveals it didn't know about a constraint. Sometimes it shows you were ambiguous in a way you didn't notice. Sometimes it's working from an outdated assumption about your project. The information you get tells you where the gap is.

Once you know why, ask what would have prevented it.

> What would have stopped you from doing this? What could I add to my harness so this doesn't happen again?

The agent has an opinion. Often a useful one. CLAUDE.md? A skill? A hook? A line in your rubric? Put the answer in your harness so you don't have to course-correct on the same thing twice.

Same instinct at the end of a session. Ask the agent what came up that's worth keeping.

> What did we learn in this session that we should capture so it doesn't get lost?

You'll get back a mix: things you decided, conventions you settled on, gotchas you ran into, fixes you made. Pull what's worth keeping into your harness.

Sometimes you don't need to ask. The pattern is clear from what just happened. Annoying behavior you've seen twice goes in your project instructions. A multi-step procedure you've walked the agent through more than once belongs in a skill. A constraint that should always hold goes in a hook. A taste call you keep making becomes a line in your rubric.

You won't get the harness right on day one. You aren't supposed to. The point is to grow it deliberately from the things you actually notice.
