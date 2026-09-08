# Faults

## Goal

Understand what faults Antithesis can inject so you can assess which fault
types matter for the feature's properties and whether local testing is
sufficient or Antithesis is needed.

## Fault Categories

Antithesis injects faults at the **container level** — everything in a
container shares the same fate. Placing two services in one container means
they will never experience faults in their communication with each other.

### Network Faults

Network faults disrupt packet delivery between containers. Incoming and
outgoing packets are treated independently, so all network faults are
potentially **asymmetric** (one direction disrupted while the other works).

**Baseline latency**: Always-on simulated delay and low baseline packet drop.
Not a fault event — this is the normal environment.

**Congestion**: Elevated packet loss and latency. Packets are often reordered.

**Basic network faults**: Two containers temporarily lose their connection.
Can slow, drop, or suspend packet delivery per stream.

**Partitions**: Containers split into groups. Communication within a group is
normal; between groups is disrupted. Configurable by frequency, symmetry,
group count, and duration.

**Bad nodes**: One or more containers lose the ability to communicate.
Inbound, outbound, or both.

For partitions and bad-node faults, disruption can be: all packets dropped,
packets held then delivered at once, or packets delivered with added latency
and probabilistic drops.

### Node Faults

**Node hang**: Container becomes totally unresponsive temporarily, then
resumes.

**Node throttling**: Container's CPU is limited, making it slow and less
responsive — surfaces bugs that load would find.

**Node termination**: Container is gracefully shut down or crash-killed, then
restored after a random delay. Restarted containers may get new IPs and lose
non-durable state. **Disabled by default** — must be explicitly enabled for
the tenant.

### Clock Faults

**Clock jitter**: System clock jumps forward or backward (daylight savings,
leap seconds, timezone changes). Affects all containers equally. Low-level
intrinsics like `__rdtsc()` are unaffected.

### Other Faults

**Thread pausing**: Individual threads are paused briefly, causing unexpected
interleavings. Requires instrumentation.

**CPU modulation**: Simulated processor clock speed changes, altering
concurrent thread execution order. Can trigger some of the same bugs as
thread pausing without instrumentation.

**Custom faults**: User-defined scripts invoked by the fault injector at
random intervals. Common uses: toggling admin config, triggering
compaction/GC, forking background processes.

## Fault Availability

Not all fault types are enabled by default. The set depends on tenant
configuration and the webhook used to launch runs. Node termination and clock
faults are commonly disabled in default configurations.

If a feature property depends on a specific fault type (e.g., testing crash
recovery requires node termination), confirm with the user that the fault is
enabled for their tenant. A workload that depends on a disabled fault will not
exercise the property.

## Mapping Faults to the Feature

When assessing which faults matter for a feature, consider which faults could
reveal problems in the feature's behavior:

- **Data replication features**: Network partitions and bad-node faults test
  whether writes propagate correctly when nodes are isolated. Congestion tests
  whether replication handles reordered or delayed messages.
- **Leader election / coordination features**: Network partitions and bad-node
  faults create the communication breakdowns that split-brain requires. Node
  termination tests leadership handoff.
- **Crash recovery features**: Node termination tests whether the feature
  recovers state correctly after a restart. Must be explicitly enabled.
- **Caching features**: Network partitions and congestion delay updates,
  creating stale-data windows. Clock jitter tests TTL and expiration logic.
- **Timeout / retry features**: Baseline latency, congestion, and node
  throttling make operations take longer than expected. Tests whether timeout
  and retry logic handles edge cases.
- **Scheduling / time-dependent features**: Clock jitter tests assumptions
  about monotonic time, expiration, and ordering.
- **Configuration management features**: Custom faults can toggle config
  during operation, testing hot-reload behavior.
- **Concurrent access features**: Thread pausing, CPU modulation, and network
  delays alter timing and can widen race windows in shared-state access.

## Quiet Periods

Antithesis provides `ANTITHESIS_STOP_FAULTS` to temporarily pause all fault
injection. This gives the system a recovery window. See
`references/self-driving-workload.md` for how to use quiet periods in
self-driving workloads.

Quiet periods are relevant to feature testing when:

- The feature involves recovery behavior — verify it actually recovers after
  faults stop
- You need to check a liveness property (system eventually converges)
- The feature's properties require observing behavior during a
  fault-then-recovery sequence

## Relevance to Testing Strategy

When deciding whether a feature needs Antithesis or can be tested locally:

- Features whose properties require **network partitions**, **node
  termination**, **clock jitter**, or **thread pausing** almost always need
  Antithesis — local testing can't reliably produce these conditions.
- Features whose properties require only **concurrent operations** or
  **specific timing** may be testable locally under load — Antithesis helps
  but isn't strictly required.
- Features whose properties require **specific values** or **specific
  operation sequences** are usually testable locally if you can construct the
  right workload.

Start locally regardless. Even features that ultimately need Antithesis
benefit from local validation to confirm the workload works, reach claims
fire, and assertions are correct before paying for Antithesis runs.
