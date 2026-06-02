# When Things Go Sideways

Not every session goes well. The most useful skill at this stage is recognizing failure modes early and responding to them, rather than grinding harder. Most of the moves in this chapter boil down to: stop, change something, try again. The bar for restarting is lower than you think.

---

## Stuck and not making progress

You asked. The agent tried. It didn't work. You pointed at what was wrong; the next version has a different problem. New round, new problem. Ten minutes in, the code's no better than when you started — maybe worse, because there are more moving parts. Each round trades one problem for another, or restates the old problem in different words.

Don't keep going. Change something — your prompt, your context, the files in view, the model, the session. Three failed attempts at the same approach is a signal to switch approaches, not to try harder.

The cheapest move is often to ask the agent why it thinks it's failing — not "how do we fix this" but "what's your model of what's happening?" Sometimes the answer is the bug: the agent has been operating on a wrong assumption since turn one, and naming it makes the fix obvious. Sometimes it surfaces the wrong assumption *you've* been carrying. Either way, the loop breaks. An example of how that ask might sound:

> We don't seem to be making progress. Let's stop what we are doing and figure out why we are stuck. What's your model of how this is supposed to work, and where do you think we're getting it wrong?

---

## Results getting weird

The agent acts on facts that aren't true anymore. References files that have moved. Applies conventions you stopped using. Argues with you about something you thought you settled last week. The output isn't wrong-looking on its surface — it just doesn't match your current reality.

The cause is almost always something in the agent's context. It could be auto-memory if your tool has it (Claude Code does; not every tool does). It could be a stale file you loaded earlier. It could be a line in your AGENTS.md or CLAUDE.md that hasn't been updated. The common factor: what the agent is operating on has drifted from what's actually true.

Don't just correct the wrong claim and move on. Ask the agent why it thinks that — surface the source:

> That's not true. Why do you think it is?

The answer often points right at the stale source: an old memory, an outdated file, a line in your harness that doesn't reflect current reality. Once you've found it, fix the source instead of correcting downstream every time.

If the source is auto-memory, check what's saved and prune. Important constraints belong in your harness, not memory — the harness is version-controlled and doesn't rot silently. (See [Building Your Harness](building-your-harness.md).)

---

## Context degrading

Long sessions get worse. The agent forgets things you established. Repeats mistakes you corrected. Takes longer to converge on simple answers. This is a property of the technology, not something you can prompt around — context windows fill up, and at some point the work the agent is doing starts to suffer for it.

But context is also valuable. The files you've loaded, the decisions you've made together, the agent's working model of your problem — those are real. Walking away costs something. So the right move isn't always "just start over." It depends on how much you have in the session, and how much of it is worth preserving.

Starting over isn't really losing work — the work is in your files. With a little effort, the context can live in your files too.

A few approaches, in increasing order of effort:

### Just restart

If the session is short or the context isn't carrying much beyond what's in your files, start fresh and load what you need. The cheapest move; often the right one.

### Hand off to a new session

Ask the agent to write a handoff document — what you've decided, what's done, what's still open, what assumptions are in play — to a file. Then start a new session and feed it that file. You keep the decisions and lose the bloat. This is the most generally useful technique because it works with any harness.

> I want to continue this work in a new context. Write me a handoff document at HANDOFF.md. Include anything you think would be important to a new agent starting fresh including what we've decided, what we've finished, what's still open, and any assumptions. I'll start a new session and load it in.

### Ask the agent whether to switch

The agent often has a sense of when its own context is getting muddy. Asking is cheap.

> Is this session still serving us? Would the next round of work go better in a fresh context?

### Use your tool's context controls

Some agentic tools let you hint at what to keep when context gets compacted (auto-summarization, manual pinning, and so on). The specifics are harness-dependent — check what your tool offers. Most tools give you less control than you might want; that's why the handoff-document technique exists.

---

## "Dumb agent" today

Some sessions feel dumb. Users say it literally — "Claude feels dumb today" — about an agent that was sharp yesterday and will be sharp tomorrow.

There's no specific thing you can point at. That's the recognition. The interactions just don't feel as sharp as they usually do. You can't articulate what's wrong, exactly. You just feel it.

This is different from being stuck (the agent circling a hard problem) and from results-getting-weird (the agent operating on a specific wrong claim). Dumb-agent doesn't have a "what's wrong" you can point at — it just is.

Rewind to before the session went off and try again. Start fresh if rewinding doesn't help. Sometimes more context fixes it. Sometimes you just got an off run and a new session is the cure.

---

## When to just start over

The bar is lower than you think. If a session feels off, restart. If you can't quite say why but the work isn't landing, restart. If you've been course-correcting more than working, restart.

Restarting is cheap. Salvaging a bad session is expensive. Bias toward restart, especially as you're learning. As you build calibration you'll get a better feel for when a session is recoverable; until then, the safe default is to start fresh.
