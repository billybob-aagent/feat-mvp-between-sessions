#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000/api/v1}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/bs-cookie-submission.txt}"

CLINIC_ADMIN_EMAIL="${CLINIC_ADMIN_EMAIL:-pilot-admin@betweensessions.local}"
CLINIC_ADMIN_PASSWORD="${CLINIC_ADMIN_PASSWORD:-ChangeMeAdmin1!}"

START="${START:-}"
END="${END:-}"
CLINIC_ID="${CLINIC_ID:-}"
CLIENT_ID="${CLIENT_ID:-}"

if [[ -z "${CLINIC_ID}" || -z "${CLIENT_ID}" ]]; then
  echo "== Step 1: seed pilot data (CLINIC_ID/CLIENT_ID missing)"
  SEED_LOG=$(mktemp)
  npm --prefix backend run pilot:seed | tee "${SEED_LOG}"
  SEED_JSON=$(sed -n 's/^PILOT_SEED_RESULT=//p' "${SEED_LOG}" | tail -n 1)

  if [[ -z "${SEED_JSON}" ]]; then
    echo "Seed output missing PILOT_SEED_RESULT."
    exit 1
  fi

  CLINIC_ID=$(echo "${SEED_JSON}" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    process.stdout.write(data.clinicId || "");
  ')
  CLIENT_ID=$(echo "${SEED_JSON}" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    const client = Array.isArray(data.clientIds) ? data.clientIds[0] : "";
    process.stdout.write(client || "");
  ')
  START=$(echo "${SEED_JSON}" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    process.stdout.write(data.periodStart || "");
  ')
  END=$(echo "${SEED_JSON}" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    process.stdout.write(data.periodEnd || "");
  ')
fi

if [[ -z "${CLINIC_ID}" || -z "${CLIENT_ID}" || -z "${START}" || -z "${END}" ]]; then
  echo "Set CLINIC_ID, CLIENT_ID, START, END (or seed via pilot:seed)."
  exit 1
fi

echo "CLINIC_ID=${CLINIC_ID}"
echo "CLIENT_ID=${CLIENT_ID}"
echo "PERIOD=${START} → ${END}"

echo "== Step 2: login as clinic admin"
LOGIN_TMP=$(mktemp)
LOGIN_HEADERS=$(mktemp)
curl -s -D "${LOGIN_HEADERS}" -o "${LOGIN_TMP}" -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${CLINIC_ADMIN_EMAIL}\",\"password\":\"${CLINIC_ADMIN_PASSWORD}\"}" \
  -c "${COOKIE_JAR}"
LOGIN_STATUS=$(head -n 1 "${LOGIN_HEADERS}")

echo "Login status: ${LOGIN_STATUS}"
if [[ "${LOGIN_STATUS}" != *"200"* && "${LOGIN_STATUS}" != *"201"* ]]; then
  echo "Clinic admin login failed."
  cat "${LOGIN_TMP}"
  exit 1
fi

echo "== Step 3: request submission bundle"
BUNDLE_FILE=$(mktemp)
BUNDLE_HEADERS=$(mktemp)
curl -s -D "${BUNDLE_HEADERS}" -o "${BUNDLE_FILE}" \
  -b "${COOKIE_JAR}" \
  -H "Content-Type: application/json" \
  -X POST "${BASE_URL}/reports/submission-bundle" \
  -d "{\"clinicId\":\"${CLINIC_ID}\",\"clientId\":\"${CLIENT_ID}\",\"start\":\"${START}\",\"end\":\"${END}\",\"profile\":\"IOP\",\"includeWeeklyPacket\":true,\"includeEscalations\":false}"
HTTP_STATUS=$(head -n 1 "${BUNDLE_HEADERS}")

if [[ "${HTTP_STATUS}" != *"200"* && "${HTTP_STATUS}" != *"201"* ]]; then
  echo "Bundle request failed: ${HTTP_STATUS}"
  cat "${BUNDLE_FILE}"
  exit 1
fi

echo "== Step 4: unzip bundle"
TMP_DIR=$(mktemp -d)
unzip -q "${BUNDLE_FILE}" -d "${TMP_DIR}"

for file in AER.json AER.pdf verification.txt submission_summary.txt acceptance_language.md FORBIDDEN_LANGUAGE.md weekly_packet.json; do
  if [[ ! -f "${TMP_DIR}/${file}" ]]; then
    echo "Missing ${file} in bundle."
    exit 1
  fi
done

if [[ ! -s "${TMP_DIR}/acceptance_language.md" ]]; then
  echo "acceptance_language.md is empty."
  exit 1
fi

echo "== Step 5: verify hashes"
JSON_HASH=$(shasum -a 256 "${TMP_DIR}/AER.json" | awk '{print $1}')
PDF_HASH=$(shasum -a 256 "${TMP_DIR}/AER.pdf" | awk '{print $1}')
EXPECTED_JSON=$(rg "JSON_SHA256=" "${TMP_DIR}/verification.txt" | head -n 1 | cut -d= -f2)
EXPECTED_PDF=$(rg "PDF_SHA256=" "${TMP_DIR}/verification.txt" | head -n 1 | cut -d= -f2)

if [[ "${JSON_HASH}" != "${EXPECTED_JSON}" ]]; then
  echo "JSON hash mismatch."; exit 1; fi
if [[ "${PDF_HASH}" != "${EXPECTED_PDF}" ]]; then
  echo "PDF hash mismatch."; exit 1; fi

echo "== PASS"
