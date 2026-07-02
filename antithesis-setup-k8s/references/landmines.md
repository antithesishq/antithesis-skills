# Landmines

Curated list of common platform constructs encountered during k8s minimization. Each entry follows the schema below. Entries are grouped by category, not ordered by frequency — easier to add new entries as engagements surface them.

## Entry Schema

Every entry has these fields:

- **Recognition signals** — manifest patterns indicating the construct is present (CR kinds, annotations, labels, container names, namespace patterns)
- **Default action** — `drop` / `simplify` / `replace-with-equivalent` / `replace-with-primitives`
- **Working file rationale** — one-line explanation in customer-readable language, recorded when the decision is made
- **Fidelity impact** — what behavior changes when the default is applied; which kinds of apps actually feel it
- **Override recipe** — if the customer wants to keep it, concrete steps for setup
- **Calibration question (optional)** — asked of the customer (not ops), only if the answer would change the default
- **Antithesis support (optional)** — what changes need to be informed to get this running in Antithesis
- **Confidence factors** — signals that bump confidence in the default. Low confidence triggers the calibration question; high confidence applies the default silently.

When a landmine doesn't have a calibration question, apply its default action without asking the customer. When a landmine has a calibration question, ask it only when the *Confidence factors* indicate confidence is low; otherwise apply the default silently.

---

## Service Mesh

### Istio

- **Recognition signals**:
  - Sidecar container `istio-proxy` in pod specs
  - Namespace label `istio-injection: enabled`
  - Pod annotation `sidecar.istio.io/inject: "true"`
  - Resources of kind `VirtualService`, `DestinationRule`, `Gateway`, `ServiceEntry`, `PeerAuthentication`, `AuthorizationPolicy`, `RequestAuthentication`
  - Namespace `istio-system`
- **Default action**: `drop`. Remove Istio CRs, strip injection labels and annotations, drop `istio-proxy` sidecars from pod specs.
- **Working file rationale**: "Dropped Istio mesh — pod-to-pod via direct Service DNS in single-node test env."
- **Fidelity impact**: Diverges if the app relies on mTLS workload identity for service-to-service AuthZ, Istio-level retries/timeouts, traffic splitting, fault injection used in tests, or Istio-emitted telemetry the app depends on. Most apps don't notice; some do.
- **Override recipe**: Install Istio in the test environment (`istioctl install --set profile=demo` or via Helm), re-add `istio-injection: enabled` on the SUT namespace, accept ~30–60s of extra pod startup. Note: Antithesis's deterministic single-node environment may interact unusually with Istio's distributed-system features (retries, circuit breakers).
- **Calibration question**: "Does your app's correctness depend on Istio behavior — workload identity for service-to-service AuthZ, retry/timeout policies, or traffic splitting? If unsure, drop and we'll add it back if we hit issues."
- **Antithesis support**: Antithesis does not support network faults for systems that include istio out of the box. Changes can be made on Antithesis's side to support this but this is much better left out. 
- **Confidence factors**:
  - High confidence in `drop` if only injection is configured and no `AuthorizationPolicy`, `RequestAuthentication`, or `PeerAuthentication` resources exist
  - Lower confidence (ask the calibration question) if any of those AuthZ/AuthN resources are present, since the app likely depends on Istio for AuthZ

### Linkerd

- **Recognition signals**:
  - Sidecar container `linkerd-proxy` in pod specs
  - Pod annotation `linkerd.io/inject: enabled`
  - Resources of kind `ServiceProfile`, `TrafficSplit`
  - Namespace `linkerd`
- **Default action**: `drop`. Strip injection annotations and `linkerd-proxy` sidecars, drop Linkerd CRs.
- **Working file rationale**: "Dropped Linkerd mesh — direct pod-to-pod in single-node test env."
- **Fidelity impact**: Diverges if app relies on mTLS, Linkerd-level retries, or `TrafficSplit`-driven canary testing. Less common than Istio dependence; usually safe.
- **Override recipe**: Install Linkerd in the test environment, re-add the inject annotation. Accept startup overhead.
- **Calibration question**: "Does your app behavior depend on Linkerd retries, traffic splitting, or mTLS identity? If unsure, drop and we'll add it back if we hit issues."
- **Confidence factors**: High confidence in `drop` unless `TrafficSplit` resources are present.

---

## Certificate Management

### cert-manager

- **Recognition signals**:
  - Resources of kind `Certificate`, `Issuer`, `ClusterIssuer`, `CertificateRequest`
  - Annotations `cert-manager.io/cluster-issuer`, `cert-manager.io/issuer`
  - Namespace `cert-manager`
- **Default action**: `drop`. Drop all cert-manager CRs, strip cert-manager annotations from `Ingress` resources. For `Secret` resources that cert-manager would have populated with TLS material, replace with a self-signed cert generated at startup or hand-baked into the manifest.
- **Working file rationale**: "Dropped cert-manager — TLS not material to test scope; self-signed substitute if internal TLS needed."
- **Fidelity impact**: Negligible for most apps. Diverges only if app inspects cert metadata, depends on rotation behavior, or has logic conditional on the issuing authority.
- **Override recipe**: Install cert-manager in the test environment (`kubectl apply -f https://github.com/cert-manager/cert-manager/releases/...`), use a self-signed `ClusterIssuer` instead of Let's Encrypt or any cloud issuer, accept ~30s startup delay.
- **Calibration question**: Usually skip. Ask only if the working file's *Application overview* mentions cert-related behavior (rotation testing, etc.).
- **Confidence factors**: High confidence in `drop` for typical web apps that use TLS via ingress.

---

## Secrets

### External Secrets Operator

- **Recognition signals**:
  - Resources of kind `ExternalSecret`, `SecretStore`, `ClusterSecretStore`
  - Namespace `external-secrets`
- **Default action**: `replace-with-equivalent`. For each `ExternalSecret`, create a plain `Secret` with test values (customer provides values, or skill generates placeholders for non-sensitive items). Drop `SecretStore` and the operator itself.
- **Working file rationale**: "Replaced N ExternalSecret resources with plain Secrets containing test values."
- **Fidelity impact**: None. The app sees `Secret` resources either way; the only difference is how they're populated, which is invisible to the app.
- **Override recipe**: Customer would not usually want to keep ESO — its purpose is to source from cloud secret stores, which cannot be reached from air-gapped Antithesis. Skip override.
- **Calibration question**: "For each of these N secrets, can you provide test values? Some need real-looking values for the app to function (database connection strings, etc.) and some don't (API keys for services we're stubbing). Walk through them with me."
- **Confidence factors**: This is more a workflow question than a confidence question. The replacement is mechanical; the inputs are what need customer involvement.

### Sealed Secrets

- **Recognition signals**:
  - Resources of kind `SealedSecret`
  - Controller namespace `sealed-secrets`
- **Default action**: `replace-with-equivalent`. Replace each `SealedSecret` with a plain `Secret` containing test values. Drop the controller.
- **Working file rationale**: "Replaced N SealedSecret resources with plain Secrets — encrypted-at-rest is not a concern for the test environment."
- **Fidelity impact**: None. The decrypted secret is what the app sees in either case.
- **Override recipe**: Skip override — sealed-secrets exists to gate prod-secret distribution; no purpose in test.
- **Calibration question**: Same workflow question as ExternalSecret — what test values for each.
- **Confidence factors**: High confidence in replacement.

---

## DNS

### external-dns

- **Recognition signals**:
  - Annotations `external-dns.alpha.kubernetes.io/hostname`, `external-dns.alpha.kubernetes.io/target` on `Service` or `Ingress` resources
  - Deployment named `external-dns` in namespace `external-dns` or `kube-system`
- **Default action**: `drop`. Drop the operator and strip the annotations from `Service`/`Ingress` resources. The app resolves dependencies by Service DNS within the cluster.
- **Working file rationale**: "Dropped external-dns — internal Service DNS handles intra-cluster resolution."
- **Fidelity impact**: Diverges only if the app has logic that depends on resolving its own external DNS name (rare; usually behind a CDN or load balancer in prod).
- **Override recipe**: No useful override — external-dns updates real DNS providers, which the test environment can't reach.
- **Calibration question**: None.
- **Confidence factors**: High confidence in `drop`.

---

## Networking

### NetworkPolicy

- **Recognition signals**:
  - Resources of kind `NetworkPolicy`
- **Default action**: `drop`. NetworkPolicies are CNI-enforced; in single-node Antithesis test env there's no CNI doing the enforcement.
- **Working file rationale**: "Dropped NetworkPolicy — no CNI enforcement in single-node test env."
- **Fidelity impact**: Diverges if the app's correctness depends on enforcement (e.g., a property "service A cannot reach service B" that's tested by checking enforcement). Unusual.
- **Override recipe**: No useful override in single-node setups.
- **Calibration question**: None.
- **Confidence factors**: High confidence in `drop`.

### Cloud LoadBalancer / NodePort Services

- **Recognition signals**:
  - `Service` of `type: LoadBalancer`
  - `Service` of `type: NodePort`
  - Cloud-provider-specific `Service` annotations (`service.beta.kubernetes.io/aws-load-balancer-*`, `cloud.google.com/load-balancer-type`, etc.)
- **Default action**: `simplify` to `type: ClusterIP`. Strip cloud-provider annotations.
- **Working file rationale**: "Simplified Service from LoadBalancer to ClusterIP — internal access only in test env."
- **Fidelity impact**: Diverges if the app depends on external access patterns (idle connection draining, SNI routing on a cloud LB). Setup configures port-forwarding for any external test access needed.
- **Override recipe**: Run a real load balancer in the test env (MetalLB on k3s, or a sidecar like envoy). Most tests don't need this; setup defaults to port-forward.
- **Calibration question**: None.
- **Confidence factors**: High confidence in `simplify`.

### Cloud-specific Ingress

- **Recognition signals**:
  - `Ingress` with `ingressClassName: alb` / `gce` / equivalent
  - Annotations like `alb.ingress.kubernetes.io/*`, `nginx.ingress.kubernetes.io/...`
- **Default action**: `drop` (preferred — port-forward to the SUT in test env) or `simplify` to a generic `nginx` ingress in test env if URL routing matters for the test.
- **Working file rationale**: "Dropped cloud-managed Ingress — port-forward to SUT in test env."
- **Fidelity impact**: Diverges if app depends on path-based routing, header rewriting, or other ingress-level logic that affects what the SUT sees. Surface the customer's ingress rules; ask if any of them change request shape.
- **Override recipe**: Install nginx-ingress (or whichever class) in the test env, replicate the routing rules without cloud-provider annotations.
- **Calibration question**: "Does any of your ingress configuration rewrite headers, paths, or redirect requests in ways the SUT depends on?"
- **Confidence factors**: High confidence in `drop` if Ingress only routes to a single Service. Lower confidence if Ingress has rewrite, redirect, or auth annotations.

---

## Cloud IAM

### AWS IRSA / GCP Workload Identity / Azure AD Workload Identity

- **Recognition signals**:
  - `ServiceAccount` annotations: `eks.amazonaws.com/role-arn` (AWS), `iam.gke.io/gcp-service-account` (GCP), `azure.workload.identity/client-id` (Azure)
  - Pod annotations referencing workload identity
- **Default action**: `drop` annotations. The test env uses static credentials provided by setup or stubs cloud calls entirely.
- **Working file rationale**: "Dropped IRSA / Workload Identity annotations — test env uses static creds for stubbed cloud services."
- **Fidelity impact**: The app can no longer reach real cloud services using a workload identity. This is fine because cloud services are stubbed during horizontal classification anyway.
- **Override recipe**: Customer provides test-environment AWS access keys, GCP service account JSON, or Azure principal credentials, mounted as Secrets. This only matters if a cloud service was classified as dep-real (rare).
- **Calibration question**: None — usually flowed from the horizontal stub-vs-real decisions.
- **Confidence factors**: High confidence in `drop` when cloud services are stubbed.

---

## Autoscaling and Reliability Constraints

### HorizontalPodAutoscaler / VerticalPodAutoscaler

- **Recognition signals**: Resources of kind `HorizontalPodAutoscaler`, `VerticalPodAutoscaler`
- **Default action**: `drop`. Single-node test env scales nothing.
- **Working file rationale**: "Dropped HPA/VPA — fixed replica count in test env."
- **Fidelity impact**: None unless the test specifically exercises autoscaling behavior (rare).
- **Override recipe**: Not applicable; single-node.
- **Calibration question**: None.
- **Confidence factors**: High confidence in `drop`.

### PodDisruptionBudget

- **Recognition signals**: Resources of kind `PodDisruptionBudget`
- **Default action**: `drop`. Voluntary disruptions don't apply in single-node test env.
- **Working file rationale**: "Dropped PDB — no voluntary eviction in single-node test env."
- **Fidelity impact**: None.
- **Override recipe**: Not applicable.
- **Calibration question**: None.
- **Confidence factors**: High confidence.

### ResourceQuota / LimitRange

- **Recognition signals**: Resources of kind `ResourceQuota`, `LimitRange`
- **Default action**: `drop`. Test env has no namespace-level quota enforcement.
- **Working file rationale**: "Dropped ResourceQuota/LimitRange — test env relies on per-pod resource requests/limits."
- **Fidelity impact**: None unless the app depends on being throttled by quota (very rare).
- **Override recipe**: Not applicable.
- **Calibration question**: None.
- **Confidence factors**: High confidence.

---

## Observability

### Observability Sidecars

- **Recognition signals**: Sidecar containers named `datadog-agent`, `fluent-bit`, `fluentd`, `otel-collector`, `splunk-forwarder`, `jaeger-agent`, `vector`, `filebeat`, etc.
- **Default action**: `drop` from pod specs. Antithesis has its own observability.
- **Working file rationale**: "Dropped <sidecar> sidecar — Antithesis provides observability."
- **Fidelity impact**: None unless the app has logic conditional on log forwarding (extremely rare).
- **Override recipe**: Not applicable.
- **Calibration question**: None.
- **Confidence factors**: High confidence in `drop`.

### ServiceMonitor / PodMonitor (Prometheus operator)

- **Recognition signals**: Resources of kind `ServiceMonitor`, `PodMonitor`, `PrometheusRule`
- **Default action**: `drop`.
- **Working file rationale**: "Dropped Prometheus operator CRs — Antithesis observability replaces."
- **Fidelity impact**: None.
- **Override recipe**: Not applicable.
- **Calibration question**: None.
- **Confidence factors**: High confidence.

---

## Generic CRD or Operator (Catch-all)

When you encounter a Custom Resource or operator that doesn't match any entry above, treat it as a generic landmine.

- **Recognition signals**: A CR with a group/kind not explicitly handled elsewhere; an operator Deployment whose role isn't immediately obvious.
- **Default action**: `drop`. Drop both the CR and (if present in the customer's manifests) the CRD definition. If the operator produces a workload that the SUT depends on, see `references/operator-recipes.md` for the replace-with-primitives pattern.
- **Working file rationale**: "Dropped <CR/operator> — unrecognized platform construct; flag if app relies on it."
- **Fidelity impact**: Unknown. Customer pushback when reviewing the classification is the intended flow.
- **Override recipe**: Customer states the role of the operator and how the app depends on it. If the answer is "the operator provides a runtime service the SUT calls," classify the produced workload using `references/operator-recipes.md`. If the answer is "platform-only, the SUT doesn't depend on it," confirm `drop`.
- **Calibration question**: "I don't recognize this CRD/operator. Briefly: what does it do, and does the SUT depend on its presence at runtime?"
- **Confidence factors**: Low confidence by default. Always ask the calibration question for unknown operators.
