# Context and Memory

Agents work on the words in front of them — the files you've loaded, the prompts you've written, the conversation so far, the memory the tool has saved about you. What's there, what isn't, and what's been there too long all change the work. Understanding context is one of the higher-leverage things you can learn.

## Context windows have pros and cons

The agent has a finite window of conversation it can attend to. Bigger windows let you have longer sessions, hand it more files, reason over more material. They also degrade. Long sessions tend to produce sloppier work than short ones with the same starting prompt — the agent starts forgetting things you established earlier, repeating mistakes you corrected, taking longer to converge on simple answers.

There's no fixed point where this starts; you develop a feel for it. As a rule of thumb: if a session has been going for a long time and is starting to feel less sharp than it did, you're probably running into degradation. Start a fresh session and load just the context you need.

## Context shaping is your job

What goes into the agent's view determines what comes out. Which files you load, which prompt you write, which examples you point at — these do more work than most beginners realize. A short prompt with the right files in view will often produce better work than a long detailed prompt with too much context loaded.

New users tend to either dump everything in (overload, the agent gets distracted) or load too little (the agent guesses). Find the middle: just enough to make the answer obvious.

## Auto-memory is double-edged

Tools like Claude Code have an auto-memory system — facts the agent saves about you, your project, your preferences, across sessions. Powerful when it works. Costly when it doesn't.

Memories go stale. A decision changes, a file moves, a convention evolves — but the old memory persists, and the agent keeps acting on it. The agent's confidence about an outdated fact looks the same as its confidence about a current one.

For really important things — conventions you don't want forgotten, rules you don't want broken — don't rely on auto-memory at all. Codify them in your harness (skills, hooks, AGENTS.md / CLAUDE.md) where they live as version-controlled, explicit instructions that don't rot silently.

If you start getting results that feel weirdly wrong — the agent making decisions that don't match your current state, referring to things that don't exist anymore, applying a convention you stopped using, arguing with you about something you settled — check the auto-memory.

It might be acting on what was true three months ago. Most tools let you inspect and edit memory directly. Do it. Outdated memory is one of the highest-confusion failure modes because nothing about the output looks wrong on its surface — the agent is "remembering" something, just the wrong thing.
