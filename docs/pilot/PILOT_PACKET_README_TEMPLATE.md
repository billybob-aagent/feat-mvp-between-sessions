# Pilot Packet README

Clinic: {{CLINIC_ID}}
Client: {{CLIENT_ID}}
Period: {{PERIOD_START}} to {{PERIOD_END}}
Profile: {{PROFILE}}

## Contents
- AER.json
- AER.pdf
- submission_bundle_v2.zip
- verification_internal.txt
- verification_public.txt
- UR_EMAIL_TEMPLATE.txt
- CHECKLIST.md

## Verification
1. Use `verification_public.txt` to confirm `AER.json` and `AER.pdf` hashes.
2. The bundle `verification.txt` contains the authoritative hashes.

## Regeneration
Re-run:
`bash scripts/pilot_simulation_v1.sh --out pilot_packets --profile {{PROFILE}} --period-days 7`

## What not to say
Do not claim medical necessity, diagnosis, or payer endorsement.
See `docs/ur/FORBIDDEN_LANGUAGE.md`.

## Optional screenshots
If needed, place UI screenshots in a `screenshots/` folder next to this README.
