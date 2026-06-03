# Building Your Harness

Our skills do a lot, but they aren't the whole tool. The thing you build around them — project instructions, your own skills, hooks, the rubrics you've taught the agent to apply — is your harness. The harness is the difference between a workflow that compounds over time and one you have to rediscover every session.

This chapter is the meaty one. Read it first, then return to it as your harness grows.

## Your harness is the actual tool

The agent, plus our skills, plus your harness — that is the tool you're using. Our skills are one ingredient. The rest is yours: project-level instructions, your own skills for your own recurring patterns, hooks that catch things automatically, the principles you've taught the agent to apply.

Treat this as something you build over time, not something you receive. The user who has spent a few months building up their harness has a meaningfully better experience than the user with the same agent and no harness around it.

## What the harness is for

Agents lack taste. They've absorbed an enormous amount of code — final outputs from millions of examples — but not the *whys* that led to those outputs. And the whys are what decide whether code is good. Good is partly intrinsic, mostly extrinsic: it depends on the system the code lives in, the constraints it has to satisfy, the trade-offs that were made. With the outputs but not the whys, agents produce code that looks correct without knowing whether it's appropriate. They cargo-cult patterns from elsewhere and don't probe for the constraints you're actually under — what the system needs to guarantee, what trade-offs you've already made, what failure modes you care about. Left to themselves, they build on whatever local context happens to fit, and over time that adds up to fragility.

Architecture and design are still human work. The agent is a strong collaborator on implementation; it's a much weaker one on architecture. Your job is to inject the taste and domain knowledge it doesn't have. This is part of what the harness is for: the constraints, the conventions, the system's actual shape — encoded once in your harness instead of held in your head and explained each session.

The research skill is specifically about exposing system constraints. Other skills you write yourself can do similar things for your own domain.

Before substantial work starts on something new, naming the constraints out loud is still useful:

> Before we touch the code, let's talk about the constraints. What does this need to guarantee? What trade-offs have already been made? What are we trying to avoid?

If you find yourself doing that often, that's a signal: the answers belong in your harness so you don't have to do the conversation each time.

## AGENTS.md / CLAUDE.md as a starting point

Most agentic tools support a project-level instruction file. Claude Code reads CLAUDE.md. Codex reads AGENTS.md. The agent loads these on every session in the project.

Put things in here that are true about the project no matter what task you're doing: build commands, conventions, things you don't want the agent to do, where things live, terms with specific meanings in your codebase. The more your project has captured here, the less you have to re-explain every session.

This file is also a good place for the dictates you'd otherwise correct the agent on session after session. The second time you find yourself telling the agent the same thing, it probably belongs in this file.

## Project skills

Beyond standing instructions, you can write your own skills — bundled sets of instructions the agent loads for specific kinds of task. If you find yourself walking the agent through the same multi-step procedure across sessions, that's a skill candidate.

Our antithesis-* skills are examples of this pattern. They aren't magic; they're just well-crafted instruction bundles that the agent loads when relevant. You can write your own for your project's specific work — your deploy process, your release flow, your incident response runbook. The agent is happy to help you write them.

## Hooks

Some agentic tools support hooks — scripts that fire automatically at certain points in the agent's work. A pre-commit hook can refuse a commit if tests fail. A post-edit hook can run a linter. A pre-tool hook can require confirmation for destructive commands.

Hooks turn guardrails from "the agent should do this" into "the harness will not let it slip." Powerful for the things you genuinely don't want left to chance. Worth investing in early for any rule you absolutely require.

## Hand the agent its own rubric

If you have principles you want the agent to follow — code style preferences, error handling patterns, architectural rules, things you care about that aren't enforced by your tools — write them down. Then tell the agent to use them. Either bake them into your AGENTS.md / CLAUDE.md so they apply automatically, or reference them per session ("apply the principles in PRINCIPLES.md to this change").

Agents are quite good at following an explicit rubric. They are much worse at inferring one from your reactions across a session. Write the rubric, hand it over, expect it to be followed. Correct the agent when it isn't, then add the correction to the rubric so you don't have to give it again.

## The harness evolves

You won't get the harness right on day one. You'll discover what's missing as you work. Saw the agent do something annoying twice? Add a line to your project instructions. Found yourself explaining the same thing across sessions? Maybe it's a skill. Saw the agent break a constraint that should always hold? Maybe it's a hook.

The harness gets richer over time, and that's how it should be. The point isn't to design it up front; it's to grow it deliberately from the things you actually notice.
