# Submission Bundle Workflow (Clinic Use)

Purpose: provide a repeatable, audit-safe workflow for preparing payer/UR submissions without changing AER content.

## In-app steps
1. Go to `/app/reports/submission`.
2. Select client and date range (date-only).
3. Choose a UR Profile (GENERIC, IOP, PHP, or MAT).
4. Review the bundle preview and acceptance language.
5. Toggle optional artifacts:
   - Weekly Packet (if needed by your UR process)
   - Escalations (if relevant to the period)
   - External links (clinic_admin/admin only; generates time-limited URLs)
6. Click “Download Submission Bundle (.zip)”.

## What the bundle contains
- `AER.json` and `AER.pdf` (deterministic for the same inputs).
- `verification.txt` with hashes for integrity checks.
- Optional: `weekly_packet.json`, `escalations.json`, `external_links.txt`.
- `submission_summary.txt`, `acceptance_language.md`, `FORBIDDEN_LANGUAGE.md`.

## Verification (payer/auditor)
Provide the bundle and direct reviewers to verify the hashes in `verification.txt` using standard SHA256 tooling.

## Notes
- AER content is unchanged by the profile; profiles only affect presentation and included artifacts.
- Use date-only periods (YYYY-MM-DD) to avoid timezone drift.
- External links are optional and time-limited.
