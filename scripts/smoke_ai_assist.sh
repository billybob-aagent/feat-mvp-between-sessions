#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000}"
API_BASE="${BASE_URL%/}/api/v1"

COOKIE_ADMIN="/tmp/bs-cookie-admin.txt"
COOKIE_THERAPIST="/tmp/bs-cookie-therapist.txt"

CLINIC_ID="${CLINIC_ID:-}"
CLIENT_ID="${CLIENT_ID:-}"

CLINIC_ADMIN_EMAIL="${CLINIC_ADMIN_EMAIL:-}"
CLINIC_ADMIN_PASSWORD="${CLINIC_ADMIN_PASSWORD:-}"
THERAPIST_EMAIL="${THERAPIST_EMAIL:-}"
THERAPIST_PASSWORD="${THERAPIST_PASSWORD:-}"

START="${START:-2026-01-01}"
END="${END:-2026-02-04}"

if [[ -z "${CLINIC_ID}" || -z "${CLIENT_ID}" ]]; then
  echo "Set CLINIC_ID and CLIENT_ID to run this script."
  exit 1
fi
if [[ -z "${CLINIC_ADMIN_EMAIL}" || -z "${CLINIC_ADMIN_PASSWORD}" ]]; then
  echo "Set CLINIC_ADMIN_EMAIL and CLINIC_ADMIN_PASSWORD to toggle AI settings."
  exit 1
fi
if [[ -z "${THERAPIST_EMAIL}" || -z "${THERAPIST_PASSWORD}" ]]; then
  echo "Set THERAPIST_EMAIL and THERAPIST_PASSWORD to run therapist flows."
  exit 1
fi

echo "== Step 1: login as clinic admin"
curl -i -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${CLINIC_ADMIN_EMAIL}\",\"password\":\"${CLINIC_ADMIN_PASSWORD}\"}" \
  -c "${COOKIE_ADMIN}" >/tmp/bs-ai-admin.headers

echo "$(head -n 1 /tmp/bs-ai-admin.headers || true)"

if [[ "$(head -n 1 /tmp/bs-ai-admin.headers || true)" != *"200"* && "$(head -n 1 /tmp/bs-ai-admin.headers || true)" != *"201"* ]]; then
  echo "Admin login failed."
  exit 1
fi

echo "== Step 2: disable AI for clinic"
curl -i -s -X PUT "${API_BASE}/ai/settings/${CLINIC_ID}" \
  -H "Content-Type: application/json" \
  -b "${COOKIE_ADMIN}" \
  -d "{\"enabled\":false}" | head -n 1

echo "== Step 3: login as therapist"
curl -i -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${THERAPIST_EMAIL}\",\"password\":\"${THERAPIST_PASSWORD}\"}" \
  -c "${COOKIE_THERAPIST}" >/tmp/bs-ai-therapist.headers

echo "$(head -n 1 /tmp/bs-ai-therapist.headers || true)"

if [[ "$(head -n 1 /tmp/bs-ai-therapist.headers || true)" != *"200"* && "$(head -n 1 /tmp/bs-ai-therapist.headers || true)" != *"201"* ]]; then
  echo "Therapist login failed."
  exit 1
fi

echo "== Step 4: attempt progress summary with AI disabled (expect 403)"
DISABLED_STATUS=$(curl -i -s -b "${COOKIE_THERAPIST}" -H "Content-Type: application/json" \
  -X POST "${API_BASE}/ai/progress-summary" \
  -d "{\"clinicId\":\"${CLINIC_ID}\",\"clientId\":\"${CLIENT_ID}\",\"periodStart\":\"${START}\",\"periodEnd\":\"${END}\"}" | head -n 1)

echo "${DISABLED_STATUS}"
if [[ "${DISABLED_STATUS}" != *"403"* ]]; then
  echo "Expected 403 when AI disabled."
  exit 1
fi

echo "== Step 5: enable AI for clinic"
curl -i -s -X PUT "${API_BASE}/ai/settings/${CLINIC_ID}" \
  -H "Content-Type: application/json" \
  -b "${COOKIE_ADMIN}" \
  -d "{\"enabled\":true}" | head -n 1

REVIEWED_RESPONSE_ID="${REVIEWED_RESPONSE_ID:-}"
if [[ -z "${REVIEWED_RESPONSE_ID}" ]]; then
  echo "== Step 6: find a reviewed response"
  ASSIGNMENT_ID=$(curl -s -b "${COOKIE_THERAPIST}" "${API_BASE}/assignments/therapist?clientId=${CLIENT_ID}&limit=1" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
    process.stdout.write(data?.items?.[0]?.id || "");
  ')
  if [[ -z "${ASSIGNMENT_ID}" ]]; then
    echo "No assignment found for client."; exit 1; fi

  REVIEWED_RESPONSE_ID=$(curl -s -b "${COOKIE_THERAPIST}" "${API_BASE}/responses/therapist/assignment/${ASSIGNMENT_ID}?clientId=${CLIENT_ID}&reviewed=reviewed&limit=1" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
    process.stdout.write(data?.items?.[0]?.id || "");
  ')
fi

if [[ -z "${REVIEWED_RESPONSE_ID}" ]]; then
  echo "No reviewed response found. Provide REVIEWED_RESPONSE_ID or mark one reviewed.";
  exit 1
fi

echo "REVIEWED_RESPONSE_ID=${REVIEWED_RESPONSE_ID}"

echo "== Step 7: generate progress summary draft"
PROGRESS_JSON=$(curl -s -b "${COOKIE_THERAPIST}" -H "Content-Type: application/json" \
  -X POST "${API_BASE}/ai/progress-summary" \
  -d "{\"clinicId\":\"${CLINIC_ID}\",\"clientId\":\"${CLIENT_ID}\",\"periodStart\":\"${START}\",\"periodEnd\":\"${END}\"}")

DRAFT_TEXT_FILE="/tmp/bs-ai-draft.txt"
APPLY_RESPONSE_ID=$(echo "${PROGRESS_JSON}" | node -e '
  const fs = require("fs");
  const input = fs.readFileSync(0, "utf8") || "{}";
  const data = JSON.parse(input);
  if (!data.text) {
    console.error("No draft text returned.");
    process.exit(2);
  }
  if (!data.redaction_stats) {
    console.error("No redaction_stats returned.");
    process.exit(2);
  }
  fs.writeFileSync(process.env.DRAFT_TEXT_FILE, data.text);
  process.stdout.write(data.apply_target_response_id || "");
' DRAFT_TEXT_FILE="${DRAFT_TEXT_FILE}")

if [[ -z "${APPLY_RESPONSE_ID}" ]]; then
  APPLY_RESPONSE_ID="${REVIEWED_RESPONSE_ID}"
fi

echo "APPLY_RESPONSE_ID=${APPLY_RESPONSE_ID}"

echo "== Step 8: apply draft as feedback"
PAYLOAD=$(node -e '
  const fs = require("fs");
  const text = fs.readFileSync(process.env.DRAFT_TEXT_FILE, "utf8");
  const payload = { responseId: process.env.APPLY_RESPONSE_ID, text };
  process.stdout.write(JSON.stringify(payload));
' APPLY_RESPONSE_ID="${APPLY_RESPONSE_ID}" DRAFT_TEXT_FILE="${DRAFT_TEXT_FILE}")

curl -s -b "${COOKIE_THERAPIST}" -H "Content-Type: application/json" \
  -X POST "${API_BASE}/feedback/create" \
  -d "${PAYLOAD}" | jq '.'

echo "== Step 9: confirm feedback saved"
FEEDBACK_COUNT=$(curl -s -b "${COOKIE_THERAPIST}" "${API_BASE}/feedback/by-response/${APPLY_RESPONSE_ID}" | node -e '
  const fs = require("fs");
  const data = JSON.parse(fs.readFileSync(0, "utf8") || "[]");
  process.stdout.write(String(Array.isArray(data) ? data.length : 0));
')

echo "feedback count: ${FEEDBACK_COUNT}"
if [[ "${FEEDBACK_COUNT}" == "0" ]]; then
  echo "Feedback not saved."; exit 1; fi

echo "== Step 10: fetch AER JSON and assert AI text is absent"
AER_JSON=$(curl -s -b "${COOKIE_THERAPIST}" "${API_BASE}/reports/aer/${CLINIC_ID}/${CLIENT_ID}?start=${START}&end=${END}")
node -e '
  const fs = require("fs");
  const draft = fs.readFileSync(process.env.DRAFT_TEXT_FILE, "utf8") || "";
  const aer = fs.readFileSync(0, "utf8") || "{}";
  if (!draft.trim()) {
    console.error("Draft text missing.");
    process.exit(2);
  }
  if (aer.includes(draft.trim())) {
    console.error("FAIL: Draft text appears in AER JSON.");
    process.exit(2);
  }
  console.log("OK: Draft text not found in AER JSON.");
' DRAFT_TEXT_FILE="${DRAFT_TEXT_FILE}" <<< "${AER_JSON}"

echo "== Step 11: fetch AER PDF and check for draft text (best-effort)"
PDF_FILE="/tmp/bs-aer.pdf"
curl -s -b "${COOKIE_THERAPIST}" "${API_BASE}/reports/aer/${CLINIC_ID}/${CLIENT_ID}.pdf?start=${START}&end=${END}" -o "${PDF_FILE}"
if command -v strings >/dev/null 2>&1; then
  PDF_TEXT_FILE="/tmp/bs-aer.txt"
  strings "${PDF_FILE}" > "${PDF_TEXT_FILE}"
  node -e '
    const fs = require("fs");
    const draft = fs.readFileSync(process.env.DRAFT_TEXT_FILE, "utf8").trim();
    const pdfText = fs.readFileSync(process.env.PDF_TEXT_FILE, "utf8");
    if (draft && pdfText.includes(draft)) {
      console.error("FAIL: Draft text appears in AER PDF.");
      process.exit(2);
    }
    console.log("OK: Draft text not found in AER PDF.");
  ' DRAFT_TEXT_FILE="${DRAFT_TEXT_FILE}" PDF_TEXT_FILE="${PDF_TEXT_FILE}"
else
  echo "strings not available; skipped PDF text check."
fi

echo "== Done"
