# Faults

## Goal

Understand what faults Antithesis can inject so you can assess whether the
bug's trigger conditions require fault injection and, if so, which types.

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

If the bug's trigger hypothesis depends on a specific fault type (e.g., crash
recovery requires node termination), confirm with the user that the fault is
enabled for their tenant. A workload that depends on a disabled fault will not
find the bug.

## Mapping Faults to the Bug

When forming the trigger hypothesis, consider which faults could create the
conditions the bug needs:

- **Race conditions**: Thread pausing, CPU modulation, and network delays
  alter timing and can widen race windows.
- **Split-brain / leader conflicts**: Network partitions and bad-node faults
  create the communication breakdowns that split-brain requires.
- **Crash recovery bugs**: Node termination tests whether the system recovers
  correctly. Must be explicitly enabled.
- **Stale data / cache bugs**: Network partitions and congestion delay
  updates, creating stale-data windows.
- **Timeout bugs**: Baseline latency, congestion, and node throttling make
  operations take longer than expected.
- **Clock-dependent bugs**: Clock jitter tests assumptions about monotonic
  time, expiration, and ordering.
- **Configuration change bugs**: Custom faults can toggle config during
  operation.

## Quiet Periods

Antithesis provides `ANTITHESIS_STOP_FAULTS` to temporarily pause all fault
injection. This gives the system a recovery window. See
`references/self-driving-workload.md` for how to use quiet periods in
self-driving workloads.

Quiet periods are relevant to bug-hunting when:

- The bug involves failure to recover after faults stop
- You need to verify a liveness property (system eventually converges)
- The trigger requires a specific fault-then-recovery sequence

## Relevance to Classification

When classifying whether a bug needs Antithesis or is locally reproducible:

- Bugs that require **network partitions**, **node termination**, **clock
  jitter**, or **thread pausing** almost always need Antithesis — local
  testing can't reliably produce these conditions.
- Bugs that require only **concurrent operations** or **specific timing**
  may be reproducible locally under load — Antithesis helps but isn't
  strictly required.
- Bugs that require **specific values** or **specific operation sequences**
  are usually reproducible locally if you can construct the right workload.
