# Operator-Replacement Recipes

When an operator produces a workload the SUT depends on (e.g., `postgres-operator` creating a Postgres instance, `strimzi` creating a Kafka cluster), the operator itself is platform machinery and should be dropped — but the workload it produced needs to be described in the report so setup can construct it.

These recipes describe what primitives to specify in the working file's *Component inventory* in place of the operator-managed CR.

## Recipe Schema

Each recipe describes:

- **Operator family** — which operators this recipe applies to
- **CR signals** — what the operator-managed Custom Resource looks like
- **Replacement primitives** — what the customer's component entry should describe instead of the CR
- **Test-environment simplifications** — replica reductions, single-instance modes, etc.
- **Common configuration to extract from the CR** — fields in the CR that should map to the replacement
- **Caveats** — known divergences from the operator's typical setup

## Initial Recipes

This file ships with one worked recipe: Postgres. Redis, Kafka, MongoDB, Elasticsearch, and others are deferred to follow-up engagements as the patterns are refined. When you encounter an operator without a recipe here, work the customer through the structure described in *Recipe Schema* and add a draft entry to a follow-up issue.

---

### Postgres (Zalando, CrunchyData, CloudNativePG, percona-postgresql-operator)

**Operator family**: `postgres-operator` (Zalando), `postgres-operator` (CrunchyData/PGO), `cnpg-controller-manager` (CloudNativePG), `percona-postgresql-operator`.

**CR signals**:

- `postgresql.cnpg.io/Cluster` (CloudNativePG)
- `acid.zalan.do/postgresql` (Zalando)
- `postgres-operator.crunchydata.com/PostgresCluster` (CrunchyData)
- `pg.percona.com/PerconaPGCluster` (Percona Operator for PostgreSQL v1) or `pgv2.percona.com/PerconaPGCluster` (v2)

The CR fields differ between operators but the underlying concept is the same: a managed Postgres instance with replicas, storage, configuration, backups, and monitoring.

**Replacement primitives** (component inventory entry):

```markdown
### postgres (StatefulSet)

**Scope**: Dependency-real
**Status**: Defaulted (operator-replacement applied; flag if the app needs operator-specific behavior)

**Image**: postgres:<major-version>-alpine (matching prod major version; use official image)

**Replicas**: 1 (simplified from prod's <N>; test exercises a single-instance Postgres)

**Env vars**:
- `POSTGRES_USER` — from Secret `postgres-credentials` (test value)
- `POSTGRES_PASSWORD` — from Secret `postgres-credentials` (test value)
- `POSTGRES_DB` — value from CR's `databases:` section
- `PGDATA` — `/var/lib/postgresql/data/pgdata`

**Volume mounts**:
- `/var/lib/postgresql/data` ← PVC `postgres-data` (size from CR; minimum 1Gi)
- `/etc/postgresql/postgresql.conf` ← ConfigMap `postgres-config` (extracted from CR's `postgresql.parameters`)

**Sidecars (kept)**:
- (none — operator-injected sidecars for backup/monitoring are platform; drop)

**Sidecars (dropped)**:
- `pgbackrest` / `wal-g` — backup sidecars; not needed in test env
- `postgres-exporter` — metrics; Antithesis observability replaces

**Dependencies in**:
- <SUT names>

**Dependencies out**:
- (none; standalone)

**Decisions applied**:
- Replaced operator-managed CR with hand-rolled StatefulSet + Service + ConfigMap + PVC + Secret
- Reduced replicas from <N> to 1 (single-instance Postgres for test)
- Dropped pgbackrest sidecar — backup not relevant in test env
- Dropped postgres-exporter sidecar — Antithesis observability
- Test values for credentials (customer provides actual values via setup)
```

Plus a Service:

```markdown
### postgres-service (Service)

ClusterIP service exposing port 5432, selector matching the StatefulSet.
Decisions applied: standard ClusterIP for in-cluster access from SUT.
```

**Test-environment simplifications**:

- Replicas: prod-N → 1
- Backup, archiving, WAL shipping: drop
- Monitoring sidecars: drop
- High availability (synchronous replication, primary/replica): drop — single instance
- Connection pooling sidecar (pgbouncer) often part of CR: keep only if SUT addresses it directly (i.e., SUT connects to `pgbouncer` rather than `postgres`); otherwise drop

**Common configuration to extract from the CR**:

| CR field (varies by operator) | Replacement target |
| --- | --- |
| `postgres.version` / `postgresql.version` | StatefulSet image tag |
| `databases:` / `users:` | `POSTGRES_DB` / `POSTGRES_USER` env, plus init SQL if multiple databases |
| `volume.size` / `storage.size` | PVC size |
| `postgresql.parameters` / `parameters` | ConfigMap `postgresql.conf` content |
| `tls:` configuration | Drop in test env unless SUT requires TLS to its DB |
| `backup:` block | Drop |
| `monitoring:` / `metrics:` block | Drop |
| `numberOfInstances` / `instances` / `replicas` | Force to 1 in test |

**Caveats**:

- If the SUT's Postgres connection uses operator-injected service discovery (e.g., a `postgres-cluster.namespace.svc.cluster.local` hostname created by the operator), the replacement Service name must match what the SUT expects. Verify the SUT's `DB_HOST` env var (or equivalent) and name the replacement Service accordingly.
- Some operators provide a "writer" service and a "reader" service for primary/replica routing. With single-instance replacement, both names should resolve to the same Service. Either alias them or update the SUT's configuration to use one name.
- If the SUT relies on logical replication, change-data-capture (CDC), or other features that require specific Postgres extensions or `wal_level=logical`, those settings need to be in the replacement ConfigMap.
- If the customer's CR specifies a non-default Postgres major version, the replacement image tag should match. Compatibility issues at minor-version differences are usually fine; major-version mismatches can cause behavior changes.

---

## Adding New Recipes

When you encounter an operator without a recipe here:

1. Apply the *Generic CRD or operator* landmine entry as the immediate default.
2. Walk the customer through the *Recipe Schema* fields above to capture what the operator-managed thing is, what primitives could replace it, and what test-environment simplifications make sense.
3. Record the resulting component description in the working file under *Component inventory* for the produced workload.
4. After the engagement, contribute a draft recipe entry to this file in a follow-up PR. Each engagement adds to the curated list.

Common candidates for future recipes:

- Redis (`redis-operator`, `RedisFailover`, `RedisCluster`)
- Kafka (`kafka.strimzi.io/Kafka`, `platform.confluent.io/Kafka`)
- MongoDB (`psmdb.percona.com/PerconaServerMongoDB`, `mongodbcommunity.mongodb.com/MongoDBCommunity`)
- Elasticsearch (`elasticsearch.k8s.elastic.co/Elasticsearch`)
- RabbitMQ (`rabbitmq.com/RabbitmqCluster`)
