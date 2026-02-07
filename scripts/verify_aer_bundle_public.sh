#!/usr/bin/env bash
set -euo pipefail

INPUT_PATH="${1:-}"

if [[ -z "${INPUT_PATH}" ]]; then
  echo "Usage: $0 <path-to-zip-or-directory>"
  exit 1
fi

WORKDIR=""
CLEANUP_DIR=""

if [[ -f "${INPUT_PATH}" ]]; then
  if command -v unzip >/dev/null 2>&1; then
    WORKDIR=$(mktemp -d)
    CLEANUP_DIR="${WORKDIR}"
    unzip -q "${INPUT_PATH}" -d "${WORKDIR}"
  else
    echo "FAIL: unzip not found. Please extract the bundle and pass the directory."
    exit 1
  fi
elif [[ -d "${INPUT_PATH}" ]]; then
  WORKDIR="${INPUT_PATH}"
else
  echo "FAIL: Input path not found: ${INPUT_PATH}"
  exit 1
fi

if [[ -n "${CLEANUP_DIR}" ]]; then
  trap 'rm -rf "${CLEANUP_DIR}"' EXIT
fi

JSON_FILE="${WORKDIR}/AER.json"
PDF_FILE="${WORKDIR}/AER.pdf"
VERIFY_FILE="${WORKDIR}/verification.txt"

if [[ ! -f "${JSON_FILE}" || ! -f "${PDF_FILE}" || ! -f "${VERIFY_FILE}" ]]; then
  echo "FAIL: Missing required files. Expected AER.json, AER.pdf, verification.txt."
  exit 1
fi

JSON_HASH=$(openssl dgst -sha256 "${JSON_FILE}" | awk '{print $2}')
PDF_HASH=$(openssl dgst -sha256 "${PDF_FILE}" | awk '{print $2}')

EXPECTED_JSON=$(grep -m1 '^JSON_SHA256=' "${VERIFY_FILE}" | cut -d= -f2-)
EXPECTED_PDF=$(grep -m1 '^PDF_SHA256=' "${VERIFY_FILE}" | cut -d= -f2-)

if [[ -z "${EXPECTED_JSON}" || -z "${EXPECTED_PDF}" ]]; then
  echo "FAIL: verification.txt missing JSON_SHA256 or PDF_SHA256."
  exit 1
fi

if [[ "${JSON_HASH}" != "${EXPECTED_JSON}" ]]; then
  echo "FAIL: JSON hash mismatch."
  echo "EXPECTED_JSON_SHA256=${EXPECTED_JSON}"
  echo "COMPUTED_JSON_SHA256=${JSON_HASH}"
  exit 1
fi

if [[ "${PDF_HASH}" != "${EXPECTED_PDF}" ]]; then
  echo "FAIL: PDF hash mismatch."
  echo "EXPECTED_PDF_SHA256=${EXPECTED_PDF}"
  echo "COMPUTED_PDF_SHA256=${PDF_HASH}"
  exit 1
fi

echo "PASS"
exit 0

