# AER Verification Guide (Payer / Auditor / UR)

## What You Should Receive
A valid AER bundle contains three files:
- `AER.json`
- `AER.pdf`
- `verification.txt`

`verification.txt` includes the expected SHA-256 hashes for both JSON and PDF.

## How to Verify Integrity
1. Compute the SHA-256 hash of `AER.json`.
2. Compute the SHA-256 hash of `AER.pdf`.
3. Compare both hashes to the values in `verification.txt`.

If both match, the artifact is intact and deterministic for the period.

## Example Hash Commands
On macOS/Linux:
```
openssl dgst -sha256 AER.json
openssl dgst -sha256 AER.pdf
```

## PASS vs FAIL
**PASS** means:
- The JSON and PDF match the signed hashes in `verification.txt`.
- The artifact has not been modified since generation.

**FAIL** means:
- The JSON and/or PDF was modified, truncated, or corrupted.
- The bundle is not verifiable and should not be used for audit decisions.

## What AER Does NOT Attest To
AER does not prove:
- Clinical efficacy or medical necessity.
- Completeness of external records.
- That a clinician agrees with or endorses the contents beyond recorded review actions.

## Sample verification.txt (Redacted)
```
REPORT_ID=AER-v1:<clinicId>:<clientId>:2026-02-01:2026-02-07
GENERATED_AT=2026-02-07T23:59:59.999Z
META_VERIFICATION={"standard":"AER_STANDARD_V1","standard_version":"1.1","schema_version":"AER_STANDARD_V1","schema_sha256":"<sha256>","generator_commit":"<commit>","verification_tool_version":"verify_aer@1.1"}
JSON_SHA256=<json_sha256>
PDF_SHA256=<pdf_sha256>
NOTE=Hashes validate integrity and determinism for this period.
```

