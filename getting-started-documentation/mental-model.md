# The Right Mental Model

Most of the trouble people hit with LLM agents traces back to bringing the wrong mental model to the work. Get this part right and a lot of the rest is easier. Get it wrong and you'll spend most of your energy fighting symptoms.

---

## Collaborator, not oracle

The most common mistake new users make is treating an agent like a search engine that talks back. Ask, get answer, accept answer. That mental model gives you the worst version of what these tools can do.

The frame that works better: you are working *with* a fast, broadly-knowledgeable collaborator who is sometimes wrong, sounds confident either way, and benefits from your judgment far more than from your obedience. When you bring that mindset, you ask follow-up questions. You push back. You redirect. You treat the first output as a starting point, not an answer.

Oracles return answers. Collaborators get worked with. You want the second one.

---

## You're the pilot

The agent doesn't know your codebase the way you do. It doesn't know your team's history, the bugs you've already chased, or the constraints you can't easily write down. It will happily charge in a direction with confidence, and if you don't steer, it will get a long way down the wrong road before you notice.

You are responsible for the outcome. The agent is a tool you wield. That's not a complaint — it's the deal. Wield it well and you can do things that would otherwise be impractical. Don't, and you'll end up with a working-ish mess you don't understand.

Steer often. Check in early. Don't let it run unattended for long stretches without looking at what it's doing.

---

## They sound authoritative

Agents almost always sound confident. They don't hedge unless you ask them to, and even then the hedging tends to get wallpapered over with more confident prose. "Here's the fix" reads the same whether the fix is right or a confident wrong guess.

This is a tone problem you have to compensate for. Assume the confidence is decorative, not informative. Correct answers and incorrect ones arrive with the same delivery; the difference between them lives in whether you check.

---

## Fallibility is a feature and a weakness

LLM agents are non-deterministic. Two runs over the same prompt can produce different results. The same task can succeed cleanly one session and stumble the next.

That's frustrating. It also turns out to be useful. Determinism is a property you want for a build system. For something that's helping you think, variation is leverage — a fresh session can see what a stale one missed; one agent can review another's work and find what neither would have alone.

You can't replay an LLM the way you replay a unit test. You can vary, though. Get used to varying.

---

## Smart agent, dumb agent

Some sessions are sharper than others. The agent that solved a problem cleanly yesterday will sometimes thrash on a similar one today. Same prompt, similar files, different result.

You won't have an instinct for this on day one. Calibration takes time, and the way you develop it is by experiencing the contrast — once you've had a session that was really cracking, you start to notice when one isn't.

When you suspect you're getting the dumb version, don't keep grinding. Rewind, restart, try the prompt again. Sometimes more context fixes it. Sometimes a fresh session is the cure. There's no checklist for telling the difference; there's only the feel you develop. We can't shortcut that for you, but we can tell you it's a real thing and that experienced users notice it.
