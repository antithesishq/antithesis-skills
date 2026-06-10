# Context and Memory

Agents work on the words in front of them: the files you've loaded, the prompts you've written, the conversation so far, the memory the tool has saved about you. What's there, what isn't, and what's been there too long all change the work. Understanding how the mechanism underneath actually works is one of the higher-leverage things you can learn.

## What a context window is

The chat interface makes context look simple: you type, the agent responds, conversation continues. The mechanics underneath are different in ways that matter.

Each prompt you send is a stateless request to the LLM. The model itself has no memory of your previous messages, no idea what you asked yesterday, no thread it's continuing. So how do conversations work?

The answer is the context: with each new prompt, the agent re-sends what came before. Every previous message you wrote, every response the agent produced, every file it read, every tool it ran and the output it got back. All of it is part of the request to the LLM. Tools may compress older content as the window fills; when they do, the model sees a summary rather than the original. The model gets that bundle plus your new prompt and produces the next response. Then that response becomes part of the context for the next request. We can handwave and say the context is all the stuff that came before in the session, sent as part of each request, creating the illusion of continuity.

The context window is the limit on how big that bundle can be. It's measured in tokens (the small pieces of text the model operates on). Every model has one. Modern windows are large (hundreds of thousands of tokens, sometimes millions) but they're not unlimited.

This has consequences that aren't obvious from the chat interface. If you switch topics and come back, every message from the unrelated topic is still in the context for everything that follows. If you ask the agent to explore a codebase and it reads a thousand files before giving you a summary, the contents of all thousand files are in the context for the next request. Even if all you wanted was the summary.

## Context windows have pros and cons

Bigger windows let you have longer sessions, hand the agent more files, reason over more material. They also degrade. Long sessions tend to produce sloppier work than short ones with the same starting prompt: the agent starts forgetting things you established earlier, repeating mistakes you corrected, taking longer to converge on simple answers.

This isn't a bug to prompt around. Just because something is in the context doesn't mean the agent will actually apply it. LLMs are non-deterministic. The model doesn't apply every part of its context with equal force, and which parts it leans on can vary from run to run. The more that's in the window, the less attention each individual piece gets. The agent can effectively "forget" something that's right there in the context, not because the content is gone, but because it didn't get weighted heavily enough to matter.

As the window fills, this compounds. Earlier content competes with newer content for the agent's attention; instructions you gave early can be ignored later; relevant details get crowded out by less relevant ones.

There's no fixed point where this starts. You develop a feel for it. As a rule of thumb: if a session has been going for a long time and is starting to feel less sharp than it did, you're probably running into degradation.

When you notice it, you have a few options. Restart fresh, loading just what you actually need. Ask the agent to write a handoff document and start a new session with it loaded. Ask the agent whether it thinks the next round of work would go better in a fresh context. Or use your tool's context controls if it has them. There's a full discussion in the "[Context Degrading](when-things-go-sideways.md#context-degrading)" section of "[When Things Go Sideways](when-things-go-sideways.md)".

## Context shaping is your job

What goes into the agent's view determines what comes out. Which files you load, which prompt you write, which examples you point at — these do more work than most beginners realize. A short prompt with the right files in view will often produce better work than a long detailed prompt with too much context loaded.

New users tend to either dump everything in (overload, the agent gets distracted) or load too little (the agent guesses). Find the middle: just enough to make the answer obvious.

## Auto-memory is double-edged

Tools like Claude Code have an auto-memory system — facts the agent saves about you, your project, your preferences, across sessions. Powerful when it works. Costly when it doesn't.

Memories go stale. A decision changes, a file moves, a convention evolves — but the old memory persists, and the agent keeps acting on it. The agent's confidence about an outdated fact looks the same as its confidence about a current one.

For really important things — conventions you don't want forgotten, rules you don't want broken — don't rely on auto-memory at all. Codify them in your harness (skills, hooks, AGENTS.md / CLAUDE.md) where they live as version-controlled, explicit instructions that don't rot silently.

If you start getting results that feel weirdly wrong — the agent making decisions that don't match your current state, referring to things that don't exist anymore, applying a convention you stopped using, arguing with you about something you settled — check the auto-memory.

It might be acting on what was true three months ago. Most tools let you inspect and edit memory directly. Do it. Outdated memory is one of the highest-confusion failure modes because nothing about the output looks wrong on its surface — the agent is "remembering" something, just the wrong thing.
