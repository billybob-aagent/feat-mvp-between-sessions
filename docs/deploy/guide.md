# Between Sessions™ - Production Deployment Guide

This guide covers production-ready deployment on:
- Frontend: Vercel
- Backend: Railway or AWS ECS/Fargate
- Database: Managed PostgreSQL 15+
- Cache/Queues: Managed Redis
- File storage: S3-compatible (AWS S3 or compatible)

Prereqs
- Domains for staging and production
- Stripe account with webhook secret (per env)
- Postgres, Redis, S3 credentials per env
- GitHub repo connected to Vercel (frontend)

## 1) Frontend (Vercel)
1. Import `frontend` in Vercel
2. Set build preset: Next.js
3. Set env vars:
   - `NEXT_PUBLIC_API_URL=https://api.<domain>/api/v1`
   - `NEXT_PUBLIC_STRIPE_CHECKOUT_URL` (optional)
   - `NEXT_PUBLIC_STRIPE_PORTAL_URL` (optional)
4. Regions: us-east (e.g., iad1). HIPAA alignment: use US regions only.
5. Headers/CSP/HSTS already configured in `next.config.mjs`. Vercel CDN caches static assets.

## 2) Backend (Railway)
1. Create a new service from the GitHub repo `backend`
2. Railway variables:
   - `DATABASE_URL` (from managed Postgres)
   - `REDIS_URL`
   - `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
   - `JWT_SECRET`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
   - `ALLOWED_ORIGINS=https://app.<domain>,https://<vercel-app>.vercel.app`
   - `JSON_BODY_LIMIT=1mb`
3. Start command:
   - `npx prisma migrate deploy && node dist/main.js`
4. Health check path: `/api/v1/health`
5. Add a second worker service (same image) with command for background jobs when implemented.

## 3) Backend (AWS ECS/Fargate) – alternative
1. Build and push image to ECR.
2. Create ECS service (Fargate) behind ALB with target group health check path `/api/v1/health`.
3. Task definition env vars same as Railway.
4. Security groups: ALB 443 inbound; ECS service only from ALB. No public ports on tasks.
5. Force HTTPS at ALB via redirect listener 80->443.
6. Optional: Separate worker service (same image; command runs worker entrypoint once available).

## 4) Database (PostgreSQL)
- Provision managed Postgres 15+ (Railway, RDS, Neon, etc.)
- Enforce TLS, restrict network access to backend only.
- Set `DATABASE_URL` with `?sslmode=require` when needed.
- Backups: daily snapshots + PITR if supported.

## 5) Redis (Managed)
- Provision Managed Redis (Upstash/AWS Elasticache/Railway).
- TLS preferred. Restrict access by network rules.
- Set `REDIS_URL` environment variable.

## 6) Object Storage (S3-compatible)
- Create bucket(s) per env.
- Block public access; serve via signed URLs only.
- Use SSE-S3 or SSE-KMS encryption at rest.
- Set endpoint/region/key/secret vars.

## 7) Stripe Webhooks
- In Stripe dashboard, point webhook to `https://api.<domain>/api/v1/webhooks/stripe`.
- Copy secret to `STRIPE_WEBHOOK_SECRET`.
- Ensure the route receives raw body (configured in `src/main.ts`).

## 8) Zero-downtime
- Railway/ECS rolling updates + health checks.
- Migrations run before app start via `npx prisma migrate deploy`.

## 9) Monitoring
- Poll `/api/v1/health` from uptime monitors (Better Stack, Pingdom).
- Enable logs/metrics in platform. Optionally Sentry/Axiom for app traces.

## 10) Staging
- Duplicate all resources per env (DB/Redis/S3, webhook secret, domains).
- Use separate prefixes in env vars and isolated networks.

## 11) Local development
```
docker compose up -d --build
```
- Frontend: http://localhost:3000
- API: http://localhost:4000/api/v1
- MinIO: http://localhost:9001 (minio/minio123456)

Security Notes
- Only environment variables for secrets
- Strong JWT secret
- Allowed CORS origins enforced
- HSTS + CSP + headers on frontend and backend
- CSRF enabled for cookie flows
- Throttling enabled globally
