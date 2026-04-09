# Faults

## Goal

Understand the types of faults Antithesis can inject so that SUT analysis and
property discovery are grounded in what the platform actually does to your system.

## Fault Categories

Antithesis injects faults at the **container level** — everything in a container
shares the same fate. Placing two services in one container means they will never
see faults in their communication with each other. Separate containers can be
faulted independently.

### Network Faults

Network faults disrupt packet delivery between containers. Incoming and outgoing
packets are treated independently, so all network faults are potentially
**asymmetric** (one direction disrupted while the other works).

Baseline latency
: Always-on simulated network delay and a low baseline packet drop rate. Not a
fault event — this is the environment's normal behavior.

Congestion
: Periods of elevated packet loss and latency drawn from a high-latency
distribution. Packets are often reordered.

Basic network faults
: Two containers temporarily lose their connection, simulating transient
equipment failure within a rack or availability zone. Can slow, drop, or
suspend packet delivery on a per-stream basis.

Partitions
: Containers are split into groups. Communication within a group is normal;
communication between groups is disrupted. Configurable by frequency,
symmetry, group count, and duration. Other network faults (e.g. latency)
remain active during partitions.

Bad nodes
: One or more containers lose the ability to communicate. Affects inbound,
outbound, or both directions. May affect multiple containers simultaneously.

For partitions and bad-node faults, disruption can take several forms: all
packets dropped (complete disconnection), packets held until the fault expires
then delivered at once, or packets delivered with added latency and
probabilistic drops.

### Node Faults

Node hang
: A container becomes totally unresponsive for a temporary period, then resumes.

Node throttling
: A container's CPU is limited, making it slow and less responsive as if under
heavy load. Surfaces bugs that load testing or DoS attacks would find.

Node termination
: A container is either gracefully shut down or crash-killed, then restored
after a random delay. Restarted containers may get new IP addresses and may
lose non-durable filesystem state. **Disabled by default** — see
[Process Fault Availability](#process-fault-availability).

### Clock Faults

Clock jitter
: The system clock jumps forward or backward, simulating daylight savings, leap
seconds, or timezone changes. Affects all containers equally (exception to the
per-container rule). Low-level intrinsics like `__rdtsc()` are unaffected.

### Other Faults

Thread pausing
: Individual threads are paused briefly, causing unexpected interleavings.
Requires [instrumentation](https://antithesis.com/docs/instrumentation/coverage_instrumentation/).

CPU modulation
: The simulated processor clock speed and instruction-level performance
characteristics change, altering the execution order of concurrent threads.
Can trigger some of the same bugs as thread pausing without requiring
instrumentation.

Custom faults
: User-defined scripts or programs invoked by the fault injector at random
intervals. Common uses: toggling admin config, triggering compaction/GC,
forking background processes. Custom faults can use the Antithesis SDK to draw
random numbers for probabilistic behavior.

## Process Fault Availability

The **`basic_test` webhook** (the default way to launch runs) **disables node
termination faults** (process kill and stop). This means containers will not be killed
or restarted during a standard run.

Customers can enable process kill/stop faults by contacting Antithesis support.
Alternatively, you can implement ad-hoc process-level faults yourself via test
commands, custom faults, or any other mechanism available in your environment.

When analyzing a system, keep this in mind: properties that depend on crash
recovery or restart behavior will not be exercised by default. Note them in the
property catalog and flag that they require process faults to be enabled.

## Requesting Quiet Periods with `ANTITHESIS_STOP_FAULTS`

Antithesis provides a global **stop-faults API** to temporarily pause all fault
injection across all containers. This gives the entire system a recovery window
to reach a stable state.

### How It Works

The environment automatically injects an `ANTITHESIS_STOP_FAULTS` binary into
every container and sets the corresponding environment variable. To request a
quiet period:

```bash
[ "${ANTITHESIS_STOP_FAULTS}" ] && "${ANTITHESIS_STOP_FAULTS}" <DURATION_SECONDS>
```

The guard clause (`[ "${ANTITHESIS_STOP_FAULTS}" ]`) lets the script run
harmlessly outside the Antithesis environment (e.g. during local testing).

When invoked:

1. **All faults stop** — network faults are restored, node faults are cleared,
   and no new faults are injected for the requested duration.
2. **Containers are restored** — killed or stopped containers are restarted, but
   they take some time to become fully operational.
3. **Faults resume automatically** after the requested duration elapses.
4. **Overlapping requests merge** — if multiple calls overlap, the quiet period
   extends to cover the largest interval.

### Using Quiet Periods for Liveness Checks

The `eventually_` test command prefix runs with faults paused, but Antithesis
does not resume testing on that branch afterward — it is a terminal check. When
you need a **mid-run liveness check** that allows testing to continue afterward,
use `ANTITHESIS_STOP_FAULTS` instead.

A typical pattern in a driver command:

1. Run workload operations while faults are active.
2. Call `ANTITHESIS_STOP_FAULTS` with enough seconds for the system to recover.
3. Wait for the system to stabilize (poll for health, retry reads, etc.).
4. Assert liveness properties (e.g. "all replicas eventually converge",
   "queued work is eventually processed").
5. Resume the workload — faults will restart automatically after the quiet period.

This is especially useful during **rolling operations** (upgrades, config
changes, migrations) where you want to verify the system recovers to a healthy
state at each step before continuing, without ending the test branch.

### When to Use Which

| Mechanism                | Faults paused? | Test continues after? | Use case                                    |
| ------------------------ | -------------- | --------------------- | ------------------------------------------- |
| `eventually_` command    | Yes            | No (terminal branch)  | Final liveness validation                   |
| `finally_` command       | Yes            | No (terminal branch)  | Post-driver invariant checks                |
| `ANTITHESIS_STOP_FAULTS` | Yes            | Yes (faults resume)   | Mid-run recovery checks, rolling operations |

## Relevance to Research

When discovering properties, consider:

- **Safety properties** should hold even while faults are active. Network
  partitions, node hangs, clock jumps, and throttling are the default tools
  Antithesis uses to stress safety guarantees.
- **Liveness properties** typically need a quiet period to verify. Note whether
  the property can be checked with an `eventually_` command or needs
  `ANTITHESIS_STOP_FAULTS` for mid-run verification.
- **Recovery properties** (crash recovery, restart correctness) require node
  termination faults, which must be explicitly enabled. Flag these in the
  property catalog.
- **Custom faults** may be needed for application-level fault scenarios (e.g.
  injecting bad config, triggering leader election via admin API). Note these
  during SUT analysis.
