# Working with Your Agent

Mental model is the foundation. This chapter is the mechanics — the moves you'll make over and over as you actually do work with an agent. Some of these will feel unnatural at first because the interface looks transactional. It isn't. The earlier you internalize that, the more leverage you get.

## Talk to it like a teammate

Picture the failure mode: you hand the agent three documents and say "make me a report." What you get back isn't what you wanted. Surprising? Not really. You didn't tell it what you wanted.

This isn't an LLM-specific problem. A human teammate handed the same three documents with the same one-line instruction is equally unlikely to produce what you want. They don't know what you're going to use it for, who the audience is, what's already been decided, or which parts you care about. They'd guess, pick a safe path, and deliver something that technically meets the brief.

The fix is the same with the agent as it is with the teammate: tell it the things they need to know. What you're trying to accomplish. Who's going to read it. What you're worried about. What you've already considered and ruled out. What good would look like.

The frame: treat the agent as a teammate, not a servant. A servant takes commands and runs with them; a teammate shares context and pushes back. The agent does its best work as the second one.

## Ask the agent about the agent

Claude is an expert on Claude. Codex is an expert on Codex. The agent knows a lot about how its tool works — features, quirks, harness mechanisms — and that knowledge is sitting there waiting for you to use it.

If you don't know how to do something with the tool itself — write a skill, tune a hook, structure your project instructions — ask. The reflexive move is to go to the docs; often it's faster to ask the agent first.

When a session goes badly, ask the agent for a retrospective. It often has a sharper sense of what tripped you up than you do.

> Looking back at this session, what got in the way? What would have made it go more smoothly?

Same trick for the long game: when you find yourself correcting the agent on the same thing repeatedly, ask how to bake the correction into your harness. CLAUDE.md? A skill? A hook? The agent knows your tool's mechanisms better than most users do.

The agent has a lot of meta-knowledge about how to work with itself. Most users never tap it.

## Iterate small

Don't try to one-shot. Tell the agent the first step. Look at what it did. Tell it the next step. Yes, you can ask it to do more in one shot — sometimes that works. But one-shot has an asymmetry: the longer the agent runs, the more depends on what it did early. A wrong call near the end is cheap to fix. A wrong call near the start — the agent picks the wrong abstraction, gets the data model wrong, sets up a bad invariant — and everything built on top has to be unwound. Frequent check-ins keep you close to those foundational decisions, where the cost of correction is still small.

This is the classic "go slow to go fast." Three small loops are almost always cheaper than one long loop that drifted. The bias toward small loops feels slower in the moment; it's almost always faster overall.

What counts as "small" will vary. Early in your experience with these tools, "small" should be baby steps — you're still learning the agent's failure modes and your harness is bare. As you get more experience and your harness fills out, "small" can grow. The corrections you've baked into your harness live in the agent's context already, so the agent doesn't make those mistakes as often. Start conservative; let the size grow as both develop.

## The patcher

Agents love to patch. A bug shows up in function X; the agent adds a special case to X. Another bug appears; another special case. A few rounds of this and you have a Jenga tower of special-cased fixes that nobody will be able to safely modify in six months.

The agent will not, left to itself, suggest a refactor. You have to ask. "This is the third patch in this area; should we refactor?" Or, more directly: "Look at this code and tell me if there's a better structure." The agent is usually quite good at the refactor — it just won't propose it unprompted.

This is one of the most important habits to develop. Without it, agent-assisted code accumulates fragility.

## Pushback as a primary mode

There's a middle ground between "accept what the agent gave you" and "throw it out and start over." Pushback. When something looks off, say so. "Why did you choose X over Y?" "I don't think that's right because Z." "This works but feels overcomplicated; can you do it simpler?" "Look at this again with [constraint] in mind."

A lot of the best work happens in this middle. New users tend to either rubber-stamp the first answer or restart the whole session. Pushback is the move in between, and it's the one you'll use most.

## You can step in

When the agent is going in circles or making something worse, you don't have to ask it to fix the problem. You can read the code yourself. You can edit the file. The agent isn't a separate authority — it's a partner, and partners hand things back and forth.

Sometimes the fastest move is "I'll handle this part, then we'll keep going." New users sometimes forget they have hands. They don't have to.

## Use a second pair of eyes

When you're not sure if the work is good, get another look at it. Open a fresh session and ask "here's what we did, what do you think?" — the new session has no investment in the prior path and will catch things the original won't. Or ask the agent itself to spawn a sub-agent to review its own work; many agentic tools support this directly.

Cheap, fast, surprisingly effective. The most-skipped move in the toolkit.

## Ensemble methods

A more structured version of the same idea. For work where being right matters more than being fast, have multiple agents do the same task independently and compare results. Disagreements are where the interesting stuff is — they flag the parts that aren't well-grounded.

Our own skills use ensemble patterns internally for high-stakes outputs. For high-stakes work in your own usage, the same idea applies. Slower; more reliable.
