# Getting Oriented

This guide is a companion to our Antithesis skills. It isn't an introduction to Antithesis itself, and it isn't a step-by-step walkthrough of any one skill. It's about working productively with LLM agents (Claude Code, Codex, or whatever you're using) when you're using our skills to test your software with Antithesis.

Read it through the first time; come back to chapters as you need them after that.

## Who this is for

We wrote this for engineers who:

- **Have written code and tests before.** The kind of test most engineers have written (give some input, check the result) is our floor. With that experience comes the everyday vocabulary of software development: bug, triage, refactor, debug, and so on. You don't need property-based testing or anything more exotic. If "what's a test" is a real question for you, this isn't where to start.

- **Have a basic familiarity with Antithesis and what you use it for.** You don't need to be an expert. You just need to have the basic shape in your head: what Antithesis does, why you'd reach for it, where it fits in how you build and test software. If that's not you yet, start at [the Antithesis introduction](https://antithesis.com/docs/introduction/welcome_to_antithesis/) before reading the rest of this guide.

- **Have at least a vague mental model of what an LLM coding tool is.** You've chatted with an LLM somewhere (ChatGPT, Claude.ai in a browser, or similar). You don't need to have used an agentic tool yet; the guide is in part here to bridge from chatbot to agentic. If you've never used any LLM at all, try one in a browser first.

- **Are comfortable enough on the command line.** The skills run inside terminal-based agents (Claude Code, Codex) and invoke other CLI tools: Docker, Snouty, and others. You don't need to be a sysadmin. You do need to be able to read an error message and look things up when something breaks. If the terminal is unfamiliar territory, this guide isn't where to start.

If you're more experienced than the floor we just described, with months or years of using these tools, there's still plenty here for you. Skim, pick what's new, come back to specific chapters when something's biting you.

If you're not at the floor on Antithesis or agentic tools yet, here's where to start:

- **New to Antithesis?** Start at [the Antithesis introduction](https://antithesis.com/docs/introduction/welcome_to_antithesis/). We'll touch on Antithesis concepts where we have to, but the real introduction lives elsewhere.
- **Never used an agentic coding tool at all?** Start at your tool's own getting-started guide: [Claude Code](https://docs.claude.com/en/docs/claude-code/overview), [Codex](https://developers.openai.com/codex/). Get the tool installed, try a small task or two, then come back here. Much of this guide lands harder without that first hands-on experience.

## Vocabulary

We define terms as we use them. The first time a term comes up, whether LLM-tool vocabulary or Antithesis-specific, we explain it then and there.

For looking something up later, or refreshing a definition you've forgotten by the time you're deep in a chapter, the [Glossary](glossary.md) collects every term we use in one place.

## How to use this guide

Read it linearly the first time. The chapters build on each other: [The Right Mental Model](mental-model.md) sets the mindset that [Working with Your Agent](working-with-your-agent.md) makes operational; [Building Your Harness](building-your-harness.md) fleshes out concepts that earlier chapters touch on briefly.

After that, treat it as a reference. When you hit a problem (the agent acting strangely, output that feels off, a session that won't converge), come back to the chapter that names what you're seeing. Each section is meant to stand on its own well enough that you don't have to reread everything before to make sense of it.

We're not trying to be the only thing you read about working with LLM agents. We're trying to be the thing that gets you working productively with Antithesis skills specifically, with enough mental model that you can keep growing from here.
