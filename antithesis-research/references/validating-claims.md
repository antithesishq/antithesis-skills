# Validating External Claims

External sources tell you things about the system. They are leads, not facts.
A claim earns nothing by being written down somewhere — it earns a place in
your analysis only when you have grounded it in evidence that *exhibits* the
behavior (the code, logs, a repro), not merely a source that *asserts* it.

You validate what you build on, not everything you read. A tracker holds
thousands of claims; you will turn a handful into properties. Validation is the
price of that promotion. A claim you are not building on, you leave inert. The
moment a claim needs validation is the moment you would state it as something
the system does, or turn it into a property.

## Two Kinds of External Input

**Claimed guarantees** — the system's own docs, design notes, and code comments
asserting intended behavior ("acknowledged writes survive failover"). Turn
these into properties and let Antithesis test them; that is what properties are
for. The one discipline: do not write that the guarantee *holds*. Write that
the system claims it and the property verifies it. A claimed guarantee is a
claim to test, not a verified fact — docs drift and lie.

**Bug reports** — an issue where someone reports a suspected defect. The weakest
input there is: one person's guess about their own problem, and the reporter is
frequently wrong about the cause. A bug report is nothing until you validate
that the reported defect is a real defect in the system. Read the primary
evidence — the attached logs, the repro, the mechanism in the code, the issue's
resolution — and rule out the ordinary alternatives: the reporter's
configuration, their environment, their misunderstanding. Only when the
evidence shows a real system defect does the report become a weakness worth a
property, grounded in the mechanism you found, not the reporter's description.
Production incident reports and postmortems are the same kind of lead —
usually stronger evidence than a single-reporter issue, but still validate that
the cause was correctly attributed to the system before you build on it.

## What Validation Requires

Name the competing explanation before you look. For a reported bug it is almost
always "this is the reporter's environment or config, not the system." Then read
the evidence that tells the two apart, and record the specific detail that
settles it. "The issue says split-brain" is not validation — it cites the claim.
"The logs show hostname resolution failing before any quorum event" is
validation — it discriminates. If you cannot quote the discriminating detail,
you have not validated the claim, and it does not enter.

Read past the headline to the part that carries the evidence. A claim in a
title or first paragraph is a headline; the logs, repro, comments, and
resolution are where the truth is — and they are the parts a hurried read
skips. Weigh the source's standing, too: an open, uncommented, single-reporter
issue is far weaker than a maintainer-confirmed one.

If you investigate and cannot settle it, the claim still does not become a fact.
Record it as an open question for a human under the file-level `Open Questions`
heading (see `references/scratchbook-setup.md`) — an unvalidated claim has no
property to attach to. Use the state tags from "Open Questions Conventions" in
`references/property-catalog.md`. It does not become a property premise or a
stated behavior.

## Worked Example: Valkey Issue #1322

The issue is titled "Sentinel split-brain after failover." Read only that far
and you conclude Valkey's Sentinel has a split-brain defect — and every property
built on top inherits a false premise.

The issue is open, has no comments, no labels, one reporter. That alone makes it
weak testimony, not an established behavior.

The reporter attached six logs and a config. They tell a different story. The
after-restart logs are flooded with `# Failed to resolve hostname
'node-mz-0.example.com'`. The config uses hostname-based Sentinel
(`resolve-hostnames yes`) and announces `node-0.example.com` — a different name
scheme than the `node-mz-*` names the running nodes try to resolve. The failover
loops: `+try-failover` then `-failover-abort-no-good-slave`, because Sentinel
cannot resolve the replica it would promote.

The competing explanation is the correct one: the nodes cannot resolve each
other's hostnames after restart. That is a deployment/DNS misconfiguration.
Sentinel is behaving correctly given names it cannot resolve. The report does
not describe a Valkey defect, so it does not become a property. The
discriminating evidence is those resolution-failure log lines, before any quorum
event.
