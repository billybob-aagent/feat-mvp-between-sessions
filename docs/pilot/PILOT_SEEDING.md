# Pilot seeding

The pilot seed script creates a realistic clinic demo dataset using existing services and deterministic timestamps.

## Quick start

```bash
npm run pilot:seed
```

The script prints a final line:

```
PILOT_SEED_RESULT={...}
```

Capture that JSON to reuse the clinic/client IDs for smoke tests.

## Inputs (env or CLI args)

Required-ish (defaults provided):
- `CLINIC_NAME`
- `CLINIC_TIMEZONE`
- `THERAPIST_EMAIL`
- `THERAPIST_NAME`
- `CLIENT_COUNT`
- `ASSIGNMENTS_PER_CLIENT`
- `START_DATE` (YYYY-MM-DD)
- `END_DATE` (YYYY-MM-DD)

Optional:
- `CLINIC_ID` (reuse an existing clinic)
- `CLINIC_ADMIN_EMAIL`
- `CLINIC_ADMIN_PASSWORD`
- `THERAPIST_PASSWORD`
- `CLIENT_PASSWORD`
- `INCLUDE_ESCALATION` (default true)
- `INCLUDE_EXTERNAL_TOKEN` (default false)
- `INCLUDE_AI_DRAFTS` (default false; only runs when AI is enabled)

CLI examples:

```bash
npm run pilot:seed -- --clinic-name="Pilot Clinic" --clinic-timezone="America/Los_Angeles" \
  --therapist-email="pilot-therapist@example.com" --therapist-name="Pilot Therapist" \
  --client-count=5 --assignments-per-client=3 --start-date=2026-02-01 --end-date=2026-02-07
```

## Notes

- Requires at least one PUBLISHED library item for the clinic.
- Responses are created via the existing submit flow, then timestamps are adjusted for deterministic periods.
- Reviewed responses are created via the mark-reviewed flow.
- AER JSON + PDF generation is validated for one seeded client.
- No raw response text is logged in output.

## Re-running / reset guidance

- Re-running `pilot:seed` is idempotent for the same clinic name and emails: existing clinic, users, and clients are reused.
- To create a fresh demo clinic, change `CLINIC_NAME` and use a new email prefix (for example, `pilot2-therapist@...`).
- There is no cleanup script. For repeatable demos, create a new clinic each time instead of deleting data.
