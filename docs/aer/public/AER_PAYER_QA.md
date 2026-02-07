# AER Payer / UR Q&A

## How do we know this wasn’t edited?
Each bundle includes `verification.txt` with SHA-256 hashes for `AER.json` and `AER.pdf`. If the hashes match, the files are identical to what was generated and have not been altered.

## Is this AI-generated?
No. AER excludes AI output. AI drafts are draft-only and never included in AER JSON or PDF.

## What if evidence is missing?
Missing evidence is explicitly surfaced (e.g., missing responses or not available fields). AER does not infer or fabricate data.

## What happens if a client doesn’t respond?
The report records that no response was captured for the relevant assignment(s). Non-response is treated as a recorded absence, not as compliance.

## Can clinicians override it?
Clinicians can review responses and add notes in their workflow, but AER is a deterministic reconstruction of recorded events. It does not allow manual overrides of evidence history.

## What’s the audit trail?
AER includes stable identifiers (`report_id`, `clinic_id`, `client_id`, period) and deterministic hashes. The bundle hash check is the external verification mechanism. Internal audit logs are separate and are not required for verification.

