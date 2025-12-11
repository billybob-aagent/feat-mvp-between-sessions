# Staging Workflow

Goals: identical to production, isolated data, safe to test migrations.

Branches
- `main`: production
- `staging`: staging

Flow
1. Merge feature PRs into `staging`.
2. CI deploys frontend to Vercel staging env and backend to Railway/ECS staging.
3. Run smoke tests against `/api/v1/health` and critical flows.
4. Approve promotion: merge `staging` -> `main`.
5. Production deploy runs with rolling update.

Env separation
- Distinct Postgres, Redis, S3 buckets, Stripe webhook secret.
- CORS `ALLOWED_ORIGINS` includes staging Vercel URL.

Data policy
- Use anonymized fixtures in staging. Never connect staging to prod data.
