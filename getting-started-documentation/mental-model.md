# The Right Mental Model

Most of the trouble people hit with LLM agents traces back to bringing the wrong mental model to the work. Get this part right and a lot of the rest is easier. Get it wrong and you'll spend most of your energy fighting symptoms.

## They sound authoritative

Agents almost always sound confident. They don't hedge unless you ask them to, and even then the hedging tends to get buried under more confident prose. "Here's the fix" reads the same whether the fix is right or a confident wrong guess.

It might tell you to use a function that doesn't exist. It might assert a property of your codebase that isn't true. It might write a five-line explanation that contradicts how the system actually works. In each case the language is the same: same tone, same structure, same delivery as when the agent is correct. There's no surface signal that separates "I checked this and I'm right" from "this feels right and I'm telling you it's right."

This isn't a quirk that better prompting fixes. LLMs work by predicting the next most likely token given what's come before. They produce plausible-sounding output, not verified output. Any individual answer should be treated as possibly wrong, including in ways the agent itself can't detect.

This is a tone problem you have to compensate for. Assume the confidence is decorative, not informative. Correct answers and incorrect ones arrive with the same delivery; the difference between them lives in whether you check. There are ways to compensate: getting a second pair of eyes, running ensemble methods (multiple agents on the same problem, comparing their answers) for high-stakes work, shaping your harness (the instructions, skills, hooks, and rubrics you build around the agent) so the agent has the right context. We cover those in [Working with Your Agent](working-with-your-agent.md) and [Building Your Harness](building-your-harness.md).

## Fallibility is a feature and a weakness

LLM agents are non-deterministic. Two runs over the same prompt can produce different results. The same task can succeed cleanly one session and stumble the next.

For programmers this feels wrong. We're trained on deterministic systems: give a function the same input and you get the same output, every time. That's reliability. Non-determinism reads as "broken" to that part of the brain.

But the non-determinism isn't a flaw the LLM has to overcome. It's the source of the LLM's usefulness. A deterministic LLM would be a lookup table: same prompt, same canned answer, forever. What makes LLMs valuable is exactly that they give you something different each time: a different angle, a different solution path, a different framing of the problem. The variation is the engine.

That cuts both ways. The variation that gives you new angles also gives you inconsistency: the same task that worked smoothly yesterday can stumble today. You can't replay the work the way you replay a unit test.

Variation has to be managed, not relied on. A fresh session can see what a stale one missed. One agent can review another's work and find what neither would have alone. Those moves only work because the agents differ. For repeatable work where you need consistency, do the opposite: codify the process in a skill, a bundle of instructions the agent loads for a particular kind of task (see [Building Your Harness](building-your-harness.md)). Get used to variation.

## Capability is uneven

Working with an LLM agent isn't like working with a junior engineer who happens to know a lot. Their capability isn't a smooth gradient that maps to human experience. One moment it's debugging a complex concurrency problem; the next it's introducing simple logic bugs and changing the tests so they pass with the new incorrect logic.

People new to LLMs get caught by this. The agent does something seemingly magical, and the natural inference is "this is a strong collaborator on hard problems." Then the next request — something simple — comes back wrong. Same agent. Same session. Different shape of task.

You can't reliably reason about what an LLM will do well or poorly based on your intuition from working with people. The "idiot-savant junior engineer" framing helps you get started but stops being useful fast. The only reliable way to know how an agent will do on a task is to try it. This is part of why non-determinism matters: even your direct evidence from one attempt doesn't guarantee the next attempt will go the same way.

As with confidence-without-correctness, the answer isn't to predict where the agent will fail. It's to compensate: get a second pair of eyes on work that matters, push back when something looks off, and use your harness to set guardrails for the failure modes you most care about. We cover those in [Working with Your Agent](working-with-your-agent.md) and [Building Your Harness](building-your-harness.md).

## Collaborator, not oracle

A common mistake new users make is treating an agent like a search engine that talks back. Ask, get answer, accept answer. That mental model gives you the worst version of what these tools can do. It stacks the costs of overconfidence, non-determinism, and uneven capability without taking advantage of any of the strengths.

The frame that works better: you are working *with* a fast, broadly-knowledgeable collaborator who is sometimes wrong, sounds confident either way, and benefits from your judgment far more than from your obedience. When you bring that mindset, you ask follow-up questions. You push back. You redirect. You treat the first output as a starting point, not an answer. We cover the specific moves in [Working with Your Agent](working-with-your-agent.md).

A collaborator who knows your project does better than one who walks in cold every session. The standing context that turns the agent from "knowledgeable stranger" into "teammate who knows the codebase" lives in [Building Your Harness](building-your-harness.md).

Oracles return answers. Collaborators get worked with. You want the second one.

## You're the pilot

The agent doesn't know your codebase the way you do. It doesn't know your team's history, the bugs you've already chased, or the constraints you can't easily write down. It will happily charge in a direction with confidence, and if you don't steer, it will get a long way down the wrong road before you notice.

You are responsible for the outcome. The agent is a tool you wield. That's not a complaint — it's the deal. Wield it well and you can do things that would otherwise be impractical. Don't, and you'll end up with a working-ish mess you don't understand.

Part of being the pilot is the work the agent can't do for itself. You set the patterns. You make the architectural calls. You decide what's worth shipping. Agents produce plausible work; you decide whether it's the right work.

Specifics on what piloting looks like in practice (when to push back, when to step in, when to start over) live in [Working with Your Agent](working-with-your-agent.md). The standing structure that supports piloting (rubrics the agent follows, hooks that catch things, project instructions that shape default behavior) lives in [Building Your Harness](building-your-harness.md).

Steer often. Check in early. Don't let it run unattended for long stretches without looking at what it's doing.
