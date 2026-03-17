# Deployment Topology

## Goal

Design the simplest container topology that covers the code you want to verify. Every extra container adds complexity and slows down Antithesis's exploration. Include only what is necessary.

## Three Component Groups

### Dependencies

External services the SUT needs to function. Find Docker images that run, simulate, or mock them.

Examples:

- Postgres → official `postgres` image
- AWS S3 → Minio
- Redis → official `redis` image
- Kafka → Redpanda or official Kafka image

Prefer lightweight alternatives that are protocol-compatible. The dependency doesn't need to be production-grade — it needs to speak the right protocol.

### Services

The processes that make up the SUT. Only package what we're actually testing. Split services between containers based on how they run in production.

- Find existing Dockerfiles in the repo and evaluate whether they can be reused or adapted.
- Plan new layered Dockerfiles if needed (base image → build stage → runtime stage).
- Each service container should run a single process.

### Clients

Containers that run the test workload. These contain the test commands that exercise the SUT.

A typical client container:

1. Emits `setup_complete` to signal readiness
2. Sleeps, letting Antithesis run test commands from the test template

The client container image includes the test template directory at `/opt/antithesis/test/v1/{name}/`. Helper files or directories kept inside that template should use a `helper_` prefix so Test Composer ignores them.

## Topology Examples

### Simple client-server

```text
+--------------------+      +--------------------+      +--------------------+
| workload client    | ---> | app server         | ---> | database           |
| (test driver)      | <--- | (SUT entrypoint)   | <--- | (dependency)       |
+--------------------+      +--------------------+      +--------------------+
                requests/responses           queries/results
```

### Complex distributed system

```text
                        +--------------------+
                        | stateful client    |
                        | (workload driver)  |
                        +---------+----------+
                                  |
                                  v
 +--------------------+   +--------------------+   +--------------------+
 | consensus node A   |<->| consensus node B   |<->| consensus node C   |
 +---------+----------+   +---------+----------+   +---------+----------+
           |                        |                        |
           +-----------+------------+------------+-----------+
                       |                         |
                       v                         v
             +--------------------+    +--------------------+
             | minio s3 storage   |    | redis cache        |
             +--------------------+    +--------------------+
```

## Simplicity Principle

The less you deploy to Antithesis while still covering the code you want to verify, the better performance and bug-finding. Every container adds state space. Every network link adds interleavings. Keep it minimal.

## Replica Decisions

- If testing consensus (e.g., Raft), run at least 3 replicas. Consensus algorithms need a quorum to exercise interesting behaviors.
- If testing a concurrent data structure, a simple client/server may suffice.
- If testing replication, run enough replicas to have a meaningful replication topology (typically 2-3).

## SDK Selection

Determine which Antithesis Language SDKs you need based on the languages used in the SUT and workload. Refer to the SDK reference and Instrumentation overview docs (available via the `antithesis-documentation` skill).

The workload client always needs the SDK to emit assertions. The SUT services may also need instrumentation for deeper coverage.

## Document the Plan

Write to `antithesis/notebook/deployment-topology.md`. For each component, document:

- Container name
- Image source (existing Dockerfile, official image, or new Dockerfile to create)
- Role (dependency, service, or client)
- What it runs
- Network connections to other containers
- Replica count (if more than one)

## Output

Write the topology plan to `antithesis/notebook/deployment-topology.md`.
