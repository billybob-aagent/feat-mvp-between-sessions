# Pilot 2-Minute Demo Script

1) What AER is
- A deterministic Adherence Evidence Report built from recorded assignments, responses, and reviews.
- It is not a diagnosis, not medical necessity, and not an AI judgment.

2) How determinism is proven
- The packet includes `verification.txt` with SHA256 hashes.
- The public verifier recomputes hashes from `AER.json` and `AER.pdf` and confirms PASS.

3) What the bundle includes
- AER JSON + PDF (same evidence, different formats).
- Optional weekly packet and escalation list (recorded events only).
- A submission summary and safe acceptance language.

4) What the verifier shows
- PASS means the files match the recorded hashes.
- FAIL means any byte changed after export.

5) Safe language clinics can use
- "Evidence is deterministic and based on recorded events."
- "Missing data is labeled; nothing is inferred."
- "AER does not determine diagnosis or medical necessity."
