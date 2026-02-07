# UR Submission Playbook (AER)

## When to Send JSON vs PDF vs Bundle
- **Bundle (preferred):** Use when integrity verification is required. Includes JSON, PDF, and verification.txt.
- **PDF only:** Use when reviewers only accept human-readable documents.
- **JSON only:** Use for automated or analytic pipelines with schema validation.

## Recommended Submission Language (Neutral)
- “This AER bundle contains a deterministic evidence report for the requested period.”
- “Integrity can be verified using the included hashes.”
- “Missing data is explicitly labeled; no evidence is inferred.”

## Language to Avoid
- “AI-generated.”
- “Medical necessity decision.”
- “Guaranteed adherence.”

## Common UR Questions and Responses
- **How do we know it wasn’t edited?**
  - “Verify the SHA-256 hashes in verification.txt against the JSON/PDF files.”
- **What if a client didn’t respond?**
  - “Non-response is recorded as missing evidence; it is not interpreted as adherence.”
- **Can clinicians override the report?**
  - “No. AER is a deterministic reconstruction of recorded events and review actions.”

## Submission Checklist
- Confirm the period and client ID are correct.
- Include the bundle for verification.
- Provide the verification guide or script if needed.

