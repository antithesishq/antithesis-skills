# Kubernetes

How to write the deployment definition for a Kubernetes-based SUT.

This is the k8s analogue of `references/docker-compose.md`. Read **this** file
instead of `docker-compose.md` when the SUT runs on Kubernetes. Everything else
in the skill — instrumentation, Dockerfiles, the language references, the SDK
and bootstrap property — applies to both deployment types unchanged. Only the
deployment-definition layer differs: Compose customers describe the system with
`docker-compose.yaml`; k8s customers describe it with Kubernetes manifests
packaged in a config image.

For the full vendor guidance this file is based on, see the Antithesis
**Kubernetes Setup guide** (`https://antithesis.com/docs/getting_started/setup_k8s/`)
and the Kubernetes environment reference for what is pre-provisioned.

## When to use this

Use the k8s path when the SUT is Kubernetes-based. The signal is that the
`antithesis-k8s-onboarding-assistance` skill has run and produced
`antithesis/scratchbook/k8s-minimization.md`. That report is this step's input:
it contains the minimized component inventory (images, replicas, env vars,
mounts, kept sidecars), stub specifications, external dependencies, and open
assumptions. Build the manifests from it.

**Do not build k8s manifests without this report.** If the SUT is clearly
Kubernetes-based (Helm chart, Kustomize tree, raw manifests, ArgoCD/Flux
`Application`s) but `k8s-minimization.md` is missing, the user likely reached
setup without running `antithesis-k8s-onboarding-assistance` first. Stop and
send them there — that skill minimizes the production manifests down to the
testable form this step consumes. Building manifests directly from a full
production deployment produces grossly oversized, broken scaffolding (platform
machinery, multi-node assumptions, external dependencies). If you genuinely
can't tell whether the system is Kubernetes-based, confirm with the user before
assuming a deployment type.

## Consuming the minimization report

`antithesis/scratchbook/k8s-minimization.md` is the source of truth for what the
manifests contain. It is produced by the `antithesis-k8s-onboarding-assistance`
skill and is a *minimized description* of the customer's system — not an
Antithesis-ready deployment. Work through it section by section, then layer the
Antithesis-wide requirements (below) on top.

- **Application overview** — confirms the SUT identity, test boundary, and what
  "running correctly" means. Use it to decide where the bootstrap property and
  the `setup_complete` signal belong (see `references/instrumentation.md`).
- **Horizontal classification** — tells you which components become manifests:
  - *SUT* and *dependency-real* components → build real manifests for each (see
    *Component inventory* below).
  - *Dependency-stub* components → fakes the report specifies but does not
    implement. **Building stubs is out of scope for this version of setup** —
    see *Stubbed dependencies* below.
  - *Out-of-scope* components → drop them; do not write manifests.
- **Component inventory** — the per-component build sheet. Translate each kept
  component into a Deployment or StatefulSet (StatefulSet for clustered services
  needing stable identity or storage):
  - *image + pull info* → container `image:` referenced by digest or tag, with
    `imagePullPolicy: Never`.
  - *replicas* → `spec.replicas` (all co-located on the single node — that's
    expected; see *How Antithesis runs k8s*).
  - *env vars and their sources* → container `env:` / `envFrom:`. Inline values
    that came from a stripped platform secret; record anything you can't resolve
    as an open assumption.
  - *volume mounts* → `volumeMounts` + `volumes`, backed by `local-path` PVCs
    with `ReadWriteOnce` (per the Do/Don't list).
  - *kept sidecars* → additional containers in the same pod.
  - *dependencies in/out* → create `ClusterIP` Services for in-cluster traffic,
    and order startup with readiness probes. Kubernetes has no `depends_on`; gate
    workloads that must wait with init containers or readiness, not start order.
- **External dependencies (non-stubbed)** — anything outside the cluster the
  test environment must still account for. The cluster is air-gapped, so each of
  these must be preloaded or made reachable in-cluster — otherwise it effectively
  becomes a stub (see below). Flag any that aren't covered.
- **Open assumptions** — decisions the onboarding skill defaulted without
  confirmation. Carry them forward: verify the ones you can while building, and
  call out the rest to the user as things to watch in the first run.

## Stubbed dependencies (not yet handled)

The minimization report may classify some dependencies as *dependency-stub* and
include *Stub specifications* describing the fake each one needs (endpoints,
response shapes, required behaviors). A stub stands in for an external dependency
the test environment shouldn't run for real (an auth service, a payment or email
provider, a cloud API). **Building those fakes is out of scope for this version
of setup** — this skill brings up the SUT and its real dependencies, but does not
yet generate stub services.

If the report contains any dep-stub components, tell the user explicitly:

- The SUT calls these dependencies, so without the fakes it may not reach
  `setup_complete` — it can hang or crash trying to talk to something that isn't
  there.
- The *Stub specifications* in the report are the spec for building them, but
  that work isn't automated yet. Surface it as a follow-up for the user and their
  Antithesis engagement team.

Do not silently drop dep-stub components, and do not report the system as fully
wired while stubs are outstanding.

## How Antithesis runs k8s

Antithesis runs the SUT in a **single-node, air-gapped K3s cluster**, applying
your manifests with `kapp`. Consequences that shape the manifests:

- Control-plane queries work — EndpointSlice discovery, RBAC, ServiceAccounts,
  and similar in-cluster API access all function.
- A multi-replica workload (e.g. a 3-replica StatefulSet) co-locates all its
  pods on the single node rather than spreading across real nodes. This is fine
  for testing distributed-system correctness; it just means the test deployment
  is one Antithesis-managed environment.
- The node has no internet connectivity. Everything the workload needs must be
  preloaded.
- K3s ships the `local-path` storage provisioner; `servicelb` is disabled and
  there is no cloud provider.

## The config image

The SUT's manifests are delivered as a **config image**: a minimal image whose
root-level `/manifests/` directory holds the Kubernetes YAML. Build it from a
`scratch` base that copies the manifests in:

```dockerfile
FROM scratch
COPY manifests/ /manifests/
```

Lay the build context out so the manifests sit beside the Dockerfile, e.g.:

```
antithesis/config/
  Dockerfile            # FROM scratch; COPY manifests/ /manifests/
  manifests/
    namespace.yaml
    statefulset.yaml
    service.yaml
    rbac.yaml
    ...
```

Antithesis applies everything under `/manifests/` to the K3s cluster with
`kapp`, which orders the apply correctly across resource kinds.

`directory-init` lays down a starter `manifests/kubernetes.yaml` — a commented
skeleton with the required fields and example `Deployment` / `StatefulSet`
shapes, plus a `noop` Deployment so the harness comes up before real components
exist. Adapt it (splitting into one file per component if you prefer) and delete
the `noop` once the SUT is in place.

## Strict manifests only

`/manifests/` must contain **strict Kubernetes manifests** — plain
`apiVersion`/`kind`/`metadata`/`spec` YAML. Helm charts and Kustomize
overlays/bases are not supported. If the customer's source is a Helm chart or
Kustomize tree, render it to static manifests first (`helm template` with prod
values, or `kustomize build`) and ship the rendered output. The onboarding
report's component inventory already reflects the rendered, minimized form; use
it as the source of truth for what the manifests should contain.

## Custom resources and operators

Custom resources (CRDs) and operators **work** in the Antithesis k8s
environment — you can ship CRD definitions and CR instances in `/manifests/` and
the operator will reconcile them. Two caveats to surface to the user:

- **Image inference does not cover operator-spawned pods.** Antithesis infers
  the images it needs from the manifests it can see. When a custom resource
  causes an operator to spin up a pod, the image for that pod is not present in
  the manifests, so it will not be inferred or provisioned automatically. Any
  such image must be made available explicitly (preloaded into the environment /
  pushed to the Antithesis registry), the same way the SUT images are. Call this
  out to the user whenever the deployment includes an operator that creates
  workloads from CRs.
- **`setup_complete` via `kapp` needs ready statuses on the CR.** If you rely on
  `kapp` success for the setup-complete signal (see below), `kapp` can only
  determine that a custom resource is ready if the CR reports a ready status
  condition. A CR without a meaningful ready status may never be seen as ready,
  so the signal may never fire. If a CR lacks ready-status reporting, emit
  `setup_complete` from the SDK instead.

## setup_complete

On the k8s path **both** of these signals are live at once, and `setup_complete`
fires on whichever arrives first:

- **`kapp` success (automatic baseline).** `kapp` reports success once all
  resources are up — every pod passing its readiness probe, controllers
  reporting available, any depended-on custom resources reporting ready. You get
  this signal for free, so if readiness is reported accurately you often need to
  do nothing else. Getting it right means: correct readiness probes on every
  pod, controllers that expose status (see *Best practices*), and ready status
  conditions on any CRs you depend on.
- **SDK `setup_complete` (optional, earlier/more precise).** Emit the event from
  the SUT via the SDK once the system is healthy, exactly as on the Compose path
  — it's a normal SDK call from application code at the point initialization
  finishes; no special manifest wiring is needed. Use it when the app is ready
  *before* `kapp` considers everything up, or when readiness isn't captured by
  pod/CR status (e.g. a CR without ready-status reporting — there `kapp` may
  never see "ready", so the SDK call is the only signal that will ever fire).

Because the first signal wins, the two are complementary, not exclusive: lean on
`kapp` by default, and add an SDK call when you need an earlier or more precise
ready point. If instead you need the SDK `setup_complete` to be authoritative
*even after* `kapp` has already succeeded — i.e. to hold off testing past
`kapp`'s view of "ready" — that is not the default behavior; reach out to
Antithesis support to override it. As with Compose, do not tie `setup_complete`
to anything under `antithesis/test/` or to a `first_` command — those do not
start until after Antithesis observes `setup_complete`.

## Best practices

These follow the Antithesis Kubernetes Setup guide. Apply them as you translate
the onboarding report's component inventory into manifests.

### Do

- **Set namespaces explicitly.** Set the `namespace` field on every resource.
  Resources without one land in `default`, which creates ambiguity and
  complicates pod-to-service communication. Using `default` is fine — just do it
  explicitly.
- **Include every required resource.** Ship manifests for everything the
  workload needs (`Namespace`, `ServiceAccount`, `RoleBinding`, etc.). `kapp`
  orders the apply, but the resources themselves must be defined. Check the
  Kubernetes environment reference for what is already pre-provisioned.
- **Use readiness probes.** A pod in `Running` is not necessarily ready to serve
  traffic. Readiness probes are the explicit signal that initialization is done;
  without them, fuzzing/tests may start before the system is prepared.
- **Tune liveness probes conservatively.** Aggressive liveness probes can kill
  pods unnecessarily in a single-node K3s environment, especially during
  injected faults.
- **Use Deployments or StatefulSets, not bare Pods.** Controllers track
  readiness, support rolling updates and restarts, and expose status fields
  (e.g. `availableReplicas`) that prevent premature success. Use StatefulSets for
  clustered services that need stable identities or storage (e.g. etcd).
- **Set resource requests.** Define `resources.requests` for all containers so
  scheduling is correct. Memory limits are strongly recommended (prevent OOM
  termination); CPU limits are optional (omitting them lets pods burst). Keep
  total CPU requests under 1 CPU (1000m) and total memory requests under 10 GiB;
  contact Antithesis support if you need more.
- **Reference images by digest or tag.** Both are accepted. Digests are
  immutable; tags are more convenient for images you build per run. Either way,
  set `imagePullPolicy: Never` (below) so nothing tries to fetch at runtime.
- **Gate bootstrap workloads.** Init containers, Jobs, and CronJobs can fail if
  they run before their dependencies are ready. Gate them (e.g. wait on Service
  endpoints or readiness) so they don't run too early.
- **Check K3s compatibility.** The K3s version Antithesis runs may differ from
  the customer's cluster: removed/deprecated `apiVersion`s (e.g.
  `PodSecurityPolicy`) and disabled alpha/beta feature gates can break manifests.
  Validate against the K3s version before submitting.
- **Use local-path storage.** PVCs must use storage class `local-path` (or leave
  `storageClassName` blank to default to it); other classes stay stuck
  `Pending`. Pre-create any directories the manifests reference, or mounts fail
  and pods `CrashLoopBackOff` / stay `Pending`.
- **Make PodDisruptionBudgets upgrade-friendly.** For restart/upgrade testing,
  avoid `minAvailable: 1` on single-replica Deployments — it blocks upgrades.

### Don't

- **Don't depend on the internet.** The cluster is air-gapped. Pulling images,
  downloading packages, or fetching external resources will fail. Common
  pitfalls: init containers using `curl`/`wget`, charts referencing public
  registries, bootstrap scripts that install packages online.
- **Always set `imagePullPolicy: Never`.** All images are pre-pulled into the
  air-gapped node, so nothing should ever try to fetch from a registry. The
  guide's hard requirement is only "not `Always`" (which forces a fetch and
  fails), but set `Never` explicitly on every container — it's the safe choice
  regardless of how the image is tagged. In particular, a `latest` tag otherwise
  defaults the pull policy to `Always`; an explicit `Never` neutralizes that.
- **Prefer a specific tag or digest over `latest`.** A digest or a stable,
  specific tag keeps runs reproducible; `latest` is mutable. With
  `imagePullPolicy: Never` set the image is used as loaded regardless, so this is
  a reproducibility preference, not a hard requirement.
- **Don't duplicate resource names.** Resources of the same kind in the same
  namespace must have unique names, or startup fails.
- **Don't use underscores in names or hostnames.** Names must follow RFC-1123:
  lowercase letters, digits, hyphens only. Underscores break DNS resolution.
- **Don't use privileged containers.** `securityContext.privileged: true`
  violates the PodSecurity baseline.
- **Don't use `hostPath` volumes.** They require the path to exist and be managed
  on the host node, which isn't guaranteed; acceptable only for specific
  system-level tools whose host paths are sure to exist.
- **Don't use `ReadWriteMany` volumes.** The local-path provisioner doesn't
  support RWX; use `ReadWriteOnce`. On a single node, multiple replicas can still
  share an RWO volume; RWX leaves PVCs `Pending`.
- **Don't oversubscribe resources.** Pods go `Pending` if requests exceed node
  capacity or the aggregate limits (1 CPU, 10 GiB total). `ResourceQuota` /
  `LimitRange` must not conflict with these.
- **Don't hardcode IPs or CIDRs.** Avoid fixed `clusterIP`s, `ipBlock` ranges in
  NetworkPolicies, and static IPs in args/env — they may overlap K3s Service/Pod
  CIDRs and break routing. `0.0.0.0` / `127.0.0.1` are fine. Use DNS / Service
  names for communication.
- **Don't rely on `Service` type `LoadBalancer`.** No cloud provider and
  `servicelb` is disabled, so `LoadBalancer` Services stay `Pending`. Use
  `ClusterIP` for pod-to-pod traffic, and `NodePort` only to reach a Service from
  the host running K3s.
- **Don't assume Services always load balance.** A `ClusterIP` Service balances
  across ready pods; a headless Service (`clusterIP: None`) only returns pod IPs,
  so load balancing must be client-side.
- **Don't require multiple nodes.** The cluster has a single (untainted) node.
  Pod anti-affinity, topology spread constraints, or rules forbidding replicas on
  the same node will prevent scheduling.

## Other Antithesis requirements

These are Antithesis-wide requirements not specific to the k8s best-practices
guide, but they still apply to the manifests and SUT images:

- **`NO_COLOR`.** Disable color/ANSI output in every container — set
  `NO_COLOR=1` (and tool-specific flags like `FORCE_COLOR=0` where needed) via
  the container `env:` blocks or via `ENV` in the SUT Dockerfiles. Antithesis
  stores raw bytes and does not render escape codes.
- **Image architecture.** All images must target `amd64` (Antithesis runs on
  x86-64). There is no `platform:` field in a manifest, so this is enforced when
  images are *built* — see the language references and `references/docker-images.md`.
  Verify with `podman image inspect <image> --format '{{.Architecture}}'`.
- **Test template mounting.** As on the Compose path
  (`references/docker-images.md` → *Clients*), ensure `/opt/antithesis/test/v1/`
  is available in the appropriate pod once workload code is added — normally the
  workload image, run as a `Deployment`. Setup only preserves the path; defining
  the commands belongs to `antithesis-workload`. (Avoid delivering them via a
  `ConfigMap` — it won't preserve the executable bit.)

## What does NOT carry over from Compose

- **`init: true`** is a Compose-only construct and has no place in the k8s path.
- The Compose "things NOT to set" list (`logging:` driver, `internal: true`
  networks, `pull_policy:`) is Compose-specific. The k8s equivalents live in the
  *Don't* list above.

## Local testing and validation

Validate locally before handing off — but know that `snouty validate` does much
less on the k8s path than on Compose, so it buys you less confidence:

- Build each SUT image and the `FROM scratch` config image with `docker build`
  (or `podman build`). There is no `platform:` field in a manifest, so confirm
  every built image targets `amd64`:
  `podman image inspect <image> --format '{{.Architecture}}'` (or the `docker`
  equivalent). Fix the image build if any report `arm64`.
- Run `snouty validate antithesis/config` against the config directory. On the
  k8s path this is a **static manifest check only**: it runs Antithesis's
  `k8s-validator` over your `manifests/` directory and reports whether the YAML
  is valid. It does **not** stand up a cluster, `kapp apply` anything, build any
  image, wait for `setup_complete`, or look at your test commands. Fix any
  validation failure, but don't read a pass as "the system comes up."

This is a real gap versus Compose, where `snouty validate` actually brings the
system up, waits for the `setup_complete` event, and structurally checks test
commands. On k8s none of that is exercised until the real Antithesis run, so the
first true end-to-end signal is the run itself — lean harder on accurate
readiness probes (so `kapp` can tell the system is up) and on reviewing the
manifests by hand. If you have a local single-node cluster (`kind`/`k3d`), a
manual `kapp`/`kubectl apply` smoke test is worth doing to catch what
`snouty validate` won't.

Producing a config directory that `snouty validate` accepts is where this skill's
responsibility ends. Submitting the run is the `antithesis-launch` skill's job —
it builds the config and SUT images, re-validates, then launches. Do not run
`snouty launch` from this skill. The local-testing principles in
`references/submit-and-test.md` apply on the k8s path too; only the build command
(`docker build` of the config image and SUT images, not `compose build`) differs.
