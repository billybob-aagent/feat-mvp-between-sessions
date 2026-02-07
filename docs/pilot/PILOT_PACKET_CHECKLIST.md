# Pilot Packet Checklist

Objective
- Produce a repeatable, verifiable packet proving assignment -> response -> review -> AER, with payer-safe submission materials.

Steps
1. Seed clinic (pilot seed).
2. Assign a published library item to a pilot client.
3. Client submits a response.
4. Therapist marks reviewed.
5. Generate AER JSON + PDF for the period.
6. Generate Submission Bundle v2 (AER + verification + optional artifacts).
7. Verify hashes (public verifier).
8. Generate UR email template.
9. Assemble the Pilot Packet folder.

Where the packet lives
- `pilot_packets/<DATE>_<CLINIC_ID>/`

What is included
- `AER.json`, `AER.pdf`: deterministic artifacts.
- `submission_bundle_v2.zip`: bundle with verification.txt and optional artifacts.
- `verification_internal.txt`: local hash checks.
- `verification_public.txt`: public verifier output.
- `UR_EMAIL_TEMPLATE.txt`: payer/UR-safe email text.
- `CHECKLIST.md`, `README.md`: explainers for recipients.

2-minute walkthrough for payers/UR
1. Open `README.md`.
2. Verify hashes in `verification.txt` using `verification_public.txt`.
3. Review AER JSON/PDF (deterministic, evidence-based).
4. If included: weekly packet and escalations are supporting artifacts, not adjudications.
