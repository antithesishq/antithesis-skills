# Vertical Classification

## Goal

For each component that survived horizontal classification (SUT or dep-real), strip platform/cloud/observability cruft. The output is a description of what the component looks like *after* minimization — what should be kept, what should be dropped, and what should be replaced.

This skill produces descriptions, not YAML. Vertical classification populates the *Component inventory* section of the working file with structured per-component entries that `antithesis-setup` later materializes.

## Framework

Two internal axes drive each per-resource decision:

**Origin** — what is this resource's purpose?

- **App** — belongs to the customer's application
- **Platform** — provided by the cluster's platform layer (mesh, ingress controller, secret operators, etc.)
- **Cloud** — cloud-provider-specific (LoadBalancer types, IAM annotations, cloud storage classes)
- **Observability** — monitoring, logging, tracing
- **Security/Policy** — admission policies, NetworkPolicies, PodDisruptionBudgets
- **Unclear**

**Necessity** — does the app need this to function?

- **Required** — won't run without it
- **Replaceable** — needed conceptually; a local equivalent exists
- **Optional** — degrades gracefully without it
- **Irrelevant** — not needed at all

## Decision Matrix

| Origin | Default action |
| --- | --- |
| App + Required | Keep |
| App + Replaceable | Simplify (LoadBalancer → ClusterIP, real PVC → emptyDir for stateless, etc.) |
| Platform | Drop |
| Cloud + Required | Replace with local equivalent |
| Cloud + Optional | Drop |
| Observability | Drop (Antithesis has its own observability) |
| Security/Policy | Drop (single-node, deterministic env) |
| Unclear | Drop unless referenced by something we're keeping |

The "Unclear → drop" default is what makes "no archaeology" work in practice. If the customer wants to keep something Unclear, they can override at customer review.

## Method, Not Encyclopedia

Don't try to enumerate every k8s construct. Most cases are obvious:

- `DaemonSet` whose image is a log shipper, agent, or CNI component → Platform → drop
- `NetworkPolicy` → Security/Policy → drop (no enforcement in single-node)
- `HorizontalPodAutoscaler`, `VerticalPodAutoscaler` → Security/Policy → drop
- `PodDisruptionBudget`, `ResourceQuota`, `LimitRange` → Security/Policy → drop
- `Service` of type `LoadBalancer` → App + Replaceable → simplify to `ClusterIP`
- `Service` of type `NodePort` → App + Replaceable → simplify to `ClusterIP` unless test needs external access
- `Ingress` with cloud-specific annotations (ALB, GCE) → Cloud → drop or simplify
- `ServiceMonitor`, `PodMonitor` → Observability → drop
- `Job` / `CronJob` whose name and image suggest the customer's app → App, classify by scope
- `Job` / `CronJob` for backups, log rotation, or platform tasks → Platform → drop

For the non-obvious cases — Antithesis-specific landmines with known recipes — read `references/landmines.md`. For operator-produced workloads where the operator itself is being dropped, read `references/operator-recipes.md`.

## Process

Five steps for each pass through vertical classification:

1. **Scan for operator-flagged components from horizontal.** Before applying the decision matrix to anything, look at the working file's *Horizontal classification* section for any operator-produced components flagged during phase 4 (e.g., a Postgres CR managed by an operator). For each, apply the matching recipe from `references/operator-recipes.md` to expand the CR into primitives in *Component inventory*. The operator itself is dropped via the matrix (Platform → drop); the produced workload becomes its own component entry to classify normally.

2. **Iterate over kept components.** For each component classified as SUT or dep-real, apply the Origin × Necessity framework. Use the curated landmines (`references/landmines.md`) for known constructs; rely on Claude's general k8s knowledge for routine ones.

3. **Surface fidelity tradeoffs.** When applying a default with meaningful fidelity impact, state the fidelity cost and the override path to the customer. See *Defaults Are Defaults* below for when this matters.

4. **Generate calibration questions when confidence is low.** Each landmine entry's *Confidence factors* tell you when to ask the calibration question. Add any calibration questions to `ops-questions.md`.

5. **Record per-component output.** Populate *Component inventory* in the working file using the schema in *Per-Component Output* below.

When all kept components have entries, advance `current_phase` to `7` (stub strategy).

## Per-Component Output

Populate the working file's *Component inventory* section. For each kept component:

```markdown
### <component-name> (<Deployment | StatefulSet | DaemonSet | etc.>)

**Scope**: <SUT | Dependency-real>
**Status**: <Confirmed | Defaulted | Open>

**Image**: <registry/image:tag> (<public | private; pull constraints if any>)

**Replicas**: <number in prod> → <number in test, with reason if simplified>

**Env vars**:
- `KEY1` — <value or source: ConfigMap, Secret, downward API>
- `KEY2` — <value or source>

**Volume mounts**:
- <path> ← <source: ConfigMap, Secret, PVC, emptyDir>

**Sidecars (kept)**:
- <name> — <reason kept>

**Sidecars (dropped)**:
- <name> — <landmine reference, e.g., "istio-proxy (see landmines.md → service mesh)">

**Dependencies in**:
- <what calls this component>

**Dependencies out**:
- <what this component calls>

**Decisions applied**:
- Kept: <list>
- Simplified: <list with before → after, e.g., "Service type LoadBalancer → ClusterIP">
- Dropped: <list with landmine reference>
- Replaced: <list with replacement description>
```

The `Decisions applied` section is the trail of what vertical minimization did. Setup reads it to understand what the component looked like in prod and what's been changed for the test environment.

When vertical classification expands an operator-managed CR into primitives (see `references/operator-recipes.md`), the *Component inventory* will gain multiple entries for what was previously one CR — typically a StatefulSet plus a Service plus possibly a ConfigMap and a Secret. Document each as its own entry; cross-reference them in the `Dependencies in/out` fields so the relationships are visible.

## Defaults Are Defaults

Every vertical decision is the skill applying a default. The customer can override any of them. When applying a default that has meaningful fidelity impact (most landmines), surface the fidelity cost and the override path; do not silently choose speed if the customer cares about fidelity.

The signal that fidelity may matter:

- The customer mentioned testing with the platform layer in prod (e.g., "we test with Istio enabled")
- The component being dropped has explicit configuration (e.g., AuthorizationPolicies, not just default injection)
- The customer's k8s comfort level signals SRE expertise — they likely understand the tradeoffs

When fidelity matters, ask the calibration question from the relevant landmine entry. When it doesn't, apply the default and move on.

## Status After Vertical Pass

When vertical classification is complete:

- Every kept component has a Component inventory entry
- Every entry has status `Confirmed`, `Defaulted`, or `Open`
- Decisions applied are listed per component, not aggregated globally
- Update `current_phase` to `7` (stub strategy)
- Generate any new ops-questions raised during vertical (calibration questions where confidence was low; questions about specific config the customer needs ops input on)

## Output

Working file *Component inventory* section, populated. `current_phase` set to `7`. Updated `ops-questions.md` if any new questions surfaced.
