# Working with Your Agent

Mental model is the foundation. This chapter is the mechanics: the moves you'll make over and over as you actually do work with an agent. Some of these will feel unnatural at first because the interface looks transactional. It isn't. The earlier you internalize that, the more you'll get out of these tools.

## Talk to it like a teammate

You hand the agent three documents and say "make me a report." What you get back isn't what you wanted. Surprising? Not really. You didn't tell it what you wanted.

This isn't an LLM-specific problem. A human teammate handed the same three documents with the same one-line instruction is equally unlikely to produce what you want. They don't know what you're going to use it for, who the audience is, what's already been decided, or which parts you care about. They'd guess, pick a safe path, and deliver something that technically meets the brief.

The fix is the same with the agent as it is with the teammate: tell it the things they need to know. What you're trying to accomplish. Who's going to read it. What you're worried about. What you've already considered and ruled out. What good would look like.

The frame: treat the agent as a teammate, not a servant. A servant takes commands and runs with them; a teammate shares context and pushes back. The agent does its best work as the second one.

## Ask the agent about the agent

Claude knows a lot about Claude. Codex knows a lot about Codex. Each agent's knowledge of how its tool works (features, quirks, harness mechanisms) is sitting there waiting for you to use.

If you don't know how to do something with the tool itself (write a skill, tune a hook, structure your project instructions), ask. The reflexive move is to go to the docs; often it's faster to ask the agent first.

When a session goes badly, ask the agent for a retrospective. It often has a sharper sense of what went wrong than you do.

> Looking back at this session, what got in the way? What would have made it go more smoothly?

Same trick for the long game: when you find yourself correcting the agent on the same thing repeatedly, ask how to bake the correction into your harness. CLAUDE.md? A skill? A hook? The agent knows your tool's mechanisms better than most users do.

## Iterate small

Don't try to one-shot. Tell the agent the first step. Look at what it did. Tell it the next step. Yes, you can ask it to do more in one shot. Sometimes that works. But one-shot has an asymmetry: the longer the agent runs, the more depends on what it did early. A wrong call near the end is cheap to fix. A wrong call near the start — the agent picks the wrong abstraction, gets the data model wrong, sets up a bad invariant — and everything built on top has to be unwound. Frequent check-ins keep you close to those foundational decisions, where the cost of correction is still small.

This is the classic "go slow to go fast." Three small loops are usually cheaper than one long loop that drifted. The bias toward small loops feels slower in the moment; it's usually faster overall.

What counts as "small" will vary. Early in your experience with these tools, "small" should be baby steps. You're still learning the agent's failure modes and your harness is bare. As you get more experience and your harness fills out, "small" can grow. The corrections you've baked into your harness live in the agent's context already, so the agent doesn't make those mistakes as often. Start conservative; let the size grow as both develop.

## The patcher

Agents love to patch. A bug shows up in function X; the agent adds a special case to X. Another bug appears; another special case. A few rounds of this and you have a Jenga tower of special-cased fixes that nobody will be able to safely modify in six months.

This happens because agents don't naturally step back. They focus on the local problem in front of them (the bug, the test, the request) and apply a local fix. Stepping back to see the pattern has to come from you.

When you notice you've patched the same area more than a few times, stop and ask for a refactor.

> This is the third patch in this area. Should we refactor?

Or, more directly: "Look at this code and tell me if there's a better structure." The agent is good at executing a refactor: moving code, restructuring. The design call, what to refactor and how, is yours. It won't propose the refactor unprompted, and won't notice the structural pattern from the inside.

The deeper move is to set things up so the agent has the design context it needs from the start: constraints, conventions, the system's actual shape. That belongs in your harness. (See [Building Your Harness](building-your-harness.md).)

This isn't optional. Without it, agent-assisted code accumulates fragility.

## Pushback as a primary mode

There's a middle ground between "accept what the agent gave you" and "throw it out and start over." But that middle has a danger: muddling. Telling the agent "try again" or "that doesn't seem right, can you do something else" puts you in the middle without giving the agent anything new to work with. You're rejecting the answer without pointing at why or what's wrong. Three rounds of that and you're no closer than when you started.

Pushback is the productive form of being in the middle. It has a shape: it points in a direction. "That doesn't account for [the constraint we just discussed]." "What happens if [X] happens?" "Why did you choose X over Y?" "I don't think that's right because Z." Each one says something specific the next answer should address. And it's the move you should use the most.

You don't have to know exactly what's wrong to push back. "Something about this feels off — I'm not sure what" is a perfectly valid move. The agent will often surface what it might be:

> Something about this feels wrong but I'm not sure what. Can you walk through your reasoning and flag anywhere you weren't confident?

And don't be afraid to be wrong. Pushback isn't adjudication. Sometimes you push back and the agent explains why your concern doesn't apply, and you learn something. That's still a win.

## You can step in

When the agent is going in circles or making something worse, you don't have to ask it to fix the problem. You can read the code yourself. You can edit the file. The agent isn't a separate authority. It's a partner, and partners hand things back and forth.

What stepping in looks like varies. Sometimes it's reading the code to see what the agent isn't seeing. Sometimes it's writing a small example of what you want and saying "do it like this." Sometimes it's just doing the thing. The trigger is usually the same: the next prompt would cost more than just handling it yourself.

When you do step in, tell the agent what you did. Agents don't always re-read files between turns. They often work from what's already in their context. If you change a file and don't tell the agent, the next thing it does may be based on the stale version it remembers. Worst case: it overwrites what you just changed.

> I edited X to do Y. Please re-read it before continuing. Let's keep going from there.

New users default to asking the agent. They don't have to.

## Use a second pair of eyes

Whether or not you think your agent has done a good job, get another agent to look at the output. This is the same instinct you'd apply with a human teammate: ask a colleague to read what you wrote or eyeball your design, even when you think it's solid. Hand the work to someone who didn't help produce it, agent or human, and they see what you can't.

What makes a fresh reviewer valuable, agent or human, is the lack of shared context. The original work had assumptions baked in: about the problem, the approach, the trade-offs you decided early. You and the agent that produced the work share those assumptions, including potentially flawed ones. A reviewer who doesn't have them reads the result on its own terms and notices things that became invisible to you and the original agent.

> Here's a piece of work. I want a fresh read on it: strengths, weaknesses, anything that looks suspect.

How you get the fresh eyes varies. Some people ask the current agent to spawn a sub-agent (a child agent run that returns its result to the parent). Some open a new session, sometimes with a different model or harness. Whatever you do, give the reviewer the same kind of setup you'd give a human: the work itself, plus the supporting material that helps make sense of it (relevant constraints, design docs, the "we decided X because Y" notes). Skip the conversation that produced the work, though. That carries the same assumptions you want fresh eyes to escape.

What this costs depends on what you ask of it. A sub-agent reviewing a small piece of work returns quickly. A fresh session asked to review a sprawling change with all the supporting documentation is expensive in both time and tokens. Either way, the technique is effective.

## Ensemble methods

Ensemble methods involve running the same task through multiple agents independently (each agent works on the problem without seeing what the others produced) and then comparing the resulting answers. The independence is essential: if one agent sees what another said, the second one anchors on it and you lose the diversity of perspective that makes the technique work.

What "multiple agents" looks like in practice varies. It might be several sessions of the same model run in parallel. It might be different models tackling the same task. It might be entirely different harnesses producing different framings of the question. The point is that each one approaches the problem fresh.

When you compare the results, you look for two things. Where they converge (multiple independent agents arriving at the same answer), you have higher confidence the answer is well-grounded. Where they diverge, you've found places that need more attention before trusting any single answer.

How you actually do the comparison varies. For a few answers, you can read them yourself and form a synthesis. For more, it's often worth handing the answers to another agent: to integrate them into a final answer, to flag where they disagree, or to pick the best of the bunch. The `antithesis-research` skill is a working example of the pattern: multiple evaluators run independently, then a synthesis stage integrates their findings. Worth a read if you want to see ensemble in action.

Ensemble works best for tasks where there's genuine room for the answer to be wrong: design proposals, code reviews, bug-finding, evaluating tradeoffs. It doesn't help with mechanical tasks where the answer either is or isn't.

This is the structured form of the same principle as *Use a second pair of eyes*: independent perspectives catch what shared perspectives miss. The difference: second-pair-of-eyes gets one fresh reviewer of finished work; ensemble has several agents do the work in parallel from the start, and compares where their answers agree and disagree.

Ensemble costs more than a single run: more time, more tokens, more sessions to manage. What you get for that cost is catching things any single agent (yours included) would miss. Use it for work where being right matters more than being fast.
