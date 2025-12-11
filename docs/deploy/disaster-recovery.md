# Disaster Recovery Plan

Objectives
- RTO: < 4 hours
- RPO: < 15 minutes (with PITR on Postgres)

Scope
- Region-wide outage, data corruption, accidental deletion, credential compromise.

Strategy
- Multi-AZ managed Postgres where possible, PITR enabled.
- Redis considered non-authoritative; queues can rebuild.
- S3 object versioning with replication to secondary region (optional).
- Immutable backups (object lock) for monthly snapshots.

Runbook: Regional Failure
1. Provision infra in secondary region (pre-provision recommended).
2. Restore Postgres from latest snapshot/PITR.
3. Deploy backend (ECS/Railway alternative region) with new env vars.
4. Point DNS of `api.<domain>` to new ALB/endpoint.
5. Redeploy frontend in same region as backend.
6. Validate health and canary; announce partial service restored.

Runbook: Data Corruption
1. Identify corrupt window via logs/alerts.
2. Restore a new Postgres instance from PITR before corruption.
3. Migrate writes to new instance by updating `DATABASE_URL`.
4. Backfill delta if feasible; otherwise notify of data loss bounds.

Runbook: Credential Compromise
1. Rotate all access keys/secrets; invalidate sessions.
2. Re-encrypt environment variables; redeploy.
3. Audit access logs; notify per HIPAA breach procedures if PHI exposure suspected.

Testing
- Annual DR simulation covering both regional failover and corruption recovery.
