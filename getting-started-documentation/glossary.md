# Glossary

Every term we define inline is collected here. LLM-tool vocabulary and Antithesis-specific terms are intermixed and alphabetized — if you forget where a definition was, look here first.

**Agent.** An LLM that can do work — read files, write code, run commands — not just answer questions. When we say "your agent," we mean the active session in your tool.

**AGENTS.md / CLAUDE.md.** A project-level instruction file that some agentic tools read on every session. AGENTS.md for Codex; CLAUDE.md for Claude Code. The contents apply across every session in the project without you having to repeat them.

**Auto-memory.** A feature in some agentic tools (notably Claude Code) that saves facts about you, your project, and your preferences across sessions. Useful when it works; costly when it goes stale.

**Context.** Everything the agent currently has in view: the conversation so far, the files it's loaded, the instructions it's been given. Context drives output.

**Context window.** The finite amount of conversation the agent can attend to. Bigger windows allow longer sessions but degrade as they fill — sessions get sloppier the longer they run.

**Ensemble methods.** Running the same task with multiple agents independently and comparing their results. Disagreement between runs flags areas that aren't well-grounded. Slower than single-pass work; more reliable.

**Harness.** Everything you build around the agent to shape how it works on your project — project instructions, your own skills, hooks. Covered in depth in [Building Your Harness](building-your-harness.md).

**Hook.** A script that fires automatically at certain points in the agent's work — for example, before a commit or after an edit. Hooks let you enforce guardrails the agent can't bypass.

**Prompt.** What you type to the agent to start or continue a session — a question, an instruction, a paste of code, a goal description.

**Rubric.** A set of principles or rules you want the agent to follow. You can hand the agent a rubric explicitly — for example, "apply the principles in PRINCIPLES.md" — instead of hoping it infers your preferences from corrections during the session.

**Session.** One continuous conversation with the agent. Sessions accumulate context as you work and end when you close them or start a new one.

**Skill.** A bundle of instructions the agent loads when needed for a specific kind of task. Our antithesis-* skills are examples. You can write your own.

**Sub-agent.** An agent spawned by another agent — typically used so the spawning agent can have a fresh-context perspective review its own work.

**Workload.** Code that drives activity in your system during an Antithesis test. Workloads exercise your system; Antithesis observes the behavior to detect failures.
