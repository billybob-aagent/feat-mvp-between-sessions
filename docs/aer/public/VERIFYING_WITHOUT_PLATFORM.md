# Verifying AER Without Platform Access

This guide assumes you have received a bundle containing:
- `AER.json`
- `AER.pdf`
- `verification.txt`

## Option A: Verify the ZIP Bundle
1. Save the bundle locally, e.g. `AER_BUNDLE_<clinicId>_<clientId>_<start>_<end>.zip`.
2. Run:
```
./scripts/verify_aer_bundle_public.sh /path/to/AER_BUNDLE.zip
```
If `unzip` is not available on your system, extract the bundle using your OS and use Option B.

## Option B: Verify an Extracted Directory
1. Extract the bundle to a directory containing `AER.json`, `AER.pdf`, and `verification.txt`.
2. Run:
```
./scripts/verify_aer_bundle_public.sh /path/to/extracted_directory
```

## Expected Output
- `PASS` with matching SHA-256 hashes indicates integrity.
- `FAIL` indicates a mismatch, corruption, or missing files.

No network calls are performed. All verification is local.
