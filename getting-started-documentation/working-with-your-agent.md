# Working with Your Agent

Mental model is the foundation. This chapter is the mechanics — the moves you'll make over and over as you actually do work with an agent. Some of these will feel unnatural at first because the interface looks transactional. It isn't. The earlier you internalize that, the more leverage you get.

## Talk to it like a partner

You can have a conversation. New users tend to issue commands and then wait — the prompt looks like a search box, so they treat it like one. Better: talk through what you're trying to do. Share what you're worried about. Ask its opinion on the approach before it starts writing code. Tell it when something feels off.

This feels strange at first because the interface invites a transactional style. Resist that. The more the agent understands what you're actually after — not just the task, but the why — the better the work it does.

## Ask the agent about the agent

Claude is an expert on Claude. Codex is reasonably good at talking about Codex. If you don't know how to do something with the tool itself — write a skill, tune a hook, structure your project instructions — ask. Stuck in a loop? Ask what could have made the session go better. Getting tired of repeating yourself? Ask how to bake it into your harness.

The agent has a lot of meta-knowledge about how to work with itself. Most users never tap it.

## Iterate small

Don't try to one-shot. Tell the agent the first step. Look at what it did. Tell it the next step. Yes, you can ask it to do more in one shot — sometimes that works. But the further it gets without a check-in, the harder course correction becomes.

Three small loops are almost always cheaper than one long loop that drifted. The bias toward small loops feels slower in the moment; it's almost always faster overall.

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
