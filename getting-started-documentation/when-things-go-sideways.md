# When Things Go Sideways

Not every session goes well. The most useful skill at this stage is recognizing failure modes early and responding to them, rather than grinding harder. Most of the moves in this chapter boil down to: stop, change something, try again. The bar for restarting is lower than you think.

---

## Stuck and not making progress

You asked. The agent tried. It didn't work. You pointed at what was wrong; the next version has a different problem. New round, new problem. Ten minutes in, the code's no better than when you started — maybe worse, because there are more moving parts. Each round trades one problem for another, or restates the old problem in different words.

Don't keep going. Change something — your prompt, your context, the files in view, the model, the session. Three failed attempts at the same approach is a signal to switch approaches, not to try harder.

The cheapest move is often to ask the agent why it thinks it's failing — not "how do we fix this" but "what's your model of what's happening?" Sometimes the answer is the bug: the agent has been operating on a wrong assumption since turn one, and naming it makes the fix obvious. Sometimes it surfaces the wrong assumption *you've* been carrying. Either way, the loop breaks. An example of how that ask might sound:

> We don't seem to be making progress. Let's stop what we are doing and figure out why we are stuck. What's your model of how this is supposed to work, and where do you think we're getting it wrong?

---

## "Dumb agent" today

Same prompt, similar files, worse results than you'd usually get. The agent isn't broken; this session just isn't on.

Rewind to before the bad turn and try again. Start fresh if rewinding doesn't help. Sometimes more context fixes it. Sometimes you just got an off run and a new session is the cure. No checklist — just calibration.

---

## Results getting weird

The agent acts on facts that aren't true anymore. References files that have moved. Applies conventions you stopped using. Argues with you about something you settled last week. The output isn't wrong-looking on its surface — it just doesn't match your current reality.

Suspect auto-memory. Check what the memory system has saved; remove or update stale entries. Important constraints belong in your harness (see [Building Your Harness](building-your-harness.md)), not memory, exactly because of this failure mode.

---

## The patcher

Agents love to patch. A bug shows up in function X; the agent adds a special case to X. Another bug appears; another special case. A few rounds of this and you have a Jenga tower of special-cased fixes that nobody will be able to safely modify in six months.

The agent will not, left to itself, suggest a refactor. You have to ask. "This is the third patch in this area; should we refactor?" Or, more directly: "Look at this code and tell me if there's a better structure." The agent is usually quite good at the refactor — it just won't propose it unprompted.

This is one of the most important habits to develop. Without it, agent-assisted code accumulates fragility.

---

## Context degrading

Long sessions get worse. The agent forgets things you established. Repeats mistakes you corrected. Takes longer to converge on simple answers. This is a property of the technology, not something you can prompt around.

The fix is mechanical: start a fresh session. Load only the context you actually need. Most users hold onto sessions longer than they should because starting over feels like losing work — it isn't, because the work is in your files, not the chat.

---

## When to just start over

The bar is lower than you think. If a session feels off, restart. If you can't quite say why but the work isn't landing, restart. If you've been course-correcting more than working, restart.

Restarting is cheap. Salvaging a bad session is expensive. Bias toward restart, especially as you're learning. As you build calibration you'll get a better feel for when a session is recoverable; until then, the safe default is to start fresh.
