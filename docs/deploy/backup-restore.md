# Backup & Restore Plan

PostgreSQL
- Daily automated snapshots with 14–30 day retention.
- Enable PITR if supported (RDS/Neon): target RPO < 5 minutes.
- Store snapshots in separate account/project for blast radius.
- Restore drill quarterly: spin up new instance from snapshot, run integrity checks.

Redis
- Use managed backups if available; otherwise treat as ephemeral cache/queues.
- Persist critical jobs to DB if needed.

S3
- Versioning enabled, lifecycle policies (transition to IA/Glacier), MFA delete for prod.
- Cross-region replication optional for DR.

Secrets
- Source of truth: platform env vars. Export encrypted backups of values to a password manager or vault.

Runbook: Restore
1. Postgres: restore latest good snapshot to new instance.
2. Update `DATABASE_URL` in backend service.
3. Validate `/api/v1/health` and canary requests.
4. Redis: re-point to replacement if applicable.
5. S3: if CRR used, switch read to replica bucket.
