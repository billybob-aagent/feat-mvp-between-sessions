#!/usr/bin/env bash
set -euo pipefail

# Smoke test: Assignment-from-Library -> client response -> clinician review -> AER JSON/PDF includes library_source.
#
# Requirements:
# - Backend running at http://localhost:4000 with global prefix /api/v1
# - Postgres reachable (DATABASE_URL) and migrations applied
# - Provide IDs via env vars or let script attempt to discover a published library item for the clinic
#
# SECURITY:
# - Do not paste real production credentials/tokens into this script.
#
# Usage (example):
#   export BASE_URL="http://localhost:4000"
#   export CLINIC_ID="<uuid>"          # required for admin flows; optional for clinic_admin/therapist
#   export CLIENT_ID="<uuid>"          # required
#   export LIBRARY_ITEM_ID="<uuid>"    # optional; script will try to discover a published item
#   export CLINIC_ADMIN_EMAIL="aer-admin@local.test"
#   export CLINIC_ADMIN_PASSWORD="ChangeMeAER1!"
#   export CLIENT_EMAIL="client@local.test"            # optional (if you want the script to submit a response)
#   export CLIENT_PASSWORD="ChangeMeClient1!"          # optional
#   export THERAPIST_EMAIL="therapist@local.test"      # optional (if you want the script to mark reviewed)
#   export THERAPIST_PASSWORD="ChangeMeTherapist1!"    # optional
#   bash scripts/smoke_assignment_library_aer.sh

BASE_URL="${BASE_URL:-http://localhost:4000}"
API_BASE="${BASE_URL%/}/api/v1"

COOKIE_ADMIN="/tmp/bs-cookie-admin.txt"
COOKIE_CLIENT="/tmp/bs-cookie-client.txt"
COOKIE_THERAPIST="/tmp/bs-cookie-therapist.txt"

CLINIC_ID="${CLINIC_ID:-}"
CLIENT_ID="${CLIENT_ID:-}"
LIBRARY_ITEM_ID="${LIBRARY_ITEM_ID:-}"

START="${START:-2026-01-01}"
END="${END:-2026-02-04}"

CLINIC_ADMIN_EMAIL="${CLINIC_ADMIN_EMAIL:-aer-admin@local.test}"
CLINIC_ADMIN_PASSWORD="${CLINIC_ADMIN_PASSWORD:-ChangeMeAER1!}"

CLIENT_EMAIL="${CLIENT_EMAIL:-}"
CLIENT_PASSWORD="${CLIENT_PASSWORD:-}"
THERAPIST_EMAIL="${THERAPIST_EMAIL:-}"
THERAPIST_PASSWORD="${THERAPIST_PASSWORD:-}"

if [[ -z "${CLIENT_ID}" ]]; then
  echo "CLIENT_ID is required."
  exit 1
fi
if [[ -z "${CLINIC_ID}" ]]; then
  echo "CLINIC_ID is required (used for AER fetch and admin scoping)."
  exit 1
fi

echo "== Step 1: login as clinic admin (cookie)"
curl -i -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${CLINIC_ADMIN_EMAIL}\",\"password\":\"${CLINIC_ADMIN_PASSWORD}\"}" \
  -c "${COOKIE_ADMIN}" >/tmp/bs-admin-login.headers

ADMIN_STATUS="$(head -n 1 /tmp/bs-admin-login.headers || true)"
echo "${ADMIN_STATUS}"

if [[ "${ADMIN_STATUS}" != *"200"* && "${ADMIN_STATUS}" != *"201"* ]]; then
  echo "Admin login failed. Check CLINIC_ADMIN_EMAIL/CLINIC_ADMIN_PASSWORD."
  exit 1
fi

echo "== Step 2: discover a published library item (if LIBRARY_ITEM_ID not provided)"
if [[ -z "${LIBRARY_ITEM_ID}" ]]; then
  # This returns an array; pick the first id deterministically.
  # Admin may need clinicId override for library endpoints; clinic admin will derive.
  QUERY=""
  if [[ -n "${CLINIC_ID}" ]]; then
    QUERY="&clinicId=${CLINIC_ID}"
  fi
  LIBRARY_ITEM_ID="$(curl -s -b "${COOKIE_ADMIN}" "${API_BASE}/library/items?status=published${QUERY}" | node -e '
    const fs = require("fs");
    const input = fs.readFileSync(0, "utf8");
    const data = JSON.parse(input || "[]");
    const first = Array.isArray(data) ? data[0] : null;
    process.stdout.write(first?.id || "");
  ')"
fi

if [[ -z "${LIBRARY_ITEM_ID}" ]]; then
  echo "No published library item found. Provide LIBRARY_ITEM_ID or publish one in the Library UI."
  exit 1
fi
echo "LIBRARY_ITEM_ID=${LIBRARY_ITEM_ID}"

echo "== Step 3: create assignment from library"
ASSIGNMENT_ID="$(curl -s -b "${COOKIE_ADMIN}" -H "Content-Type: application/json" -X POST "${API_BASE}/assignments/from-library" -d "{
  \"clinicId\": \"${CLINIC_ID}\",
  \"clientId\": \"${CLIENT_ID}\",
  \"libraryItemId\": \"${LIBRARY_ITEM_ID}\",
  \"dueDate\": \"${END}\",
  \"note\": \"Smoke test assignment from library\",
  \"program\": null,
  \"assignmentTitleOverride\": null
}" | node -e '
  const fs = require("fs");
  const input = fs.readFileSync(0, "utf8");
  const data = JSON.parse(input || "{}");
  process.stdout.write(data?.id || "");
')"

if [[ -z "${ASSIGNMENT_ID}" ]]; then
  echo "Assignment creation failed (no id returned)."
  exit 1
fi
echo "ASSIGNMENT_ID=${ASSIGNMENT_ID}"

RESPONSE_ID=""
if [[ -n "${CLIENT_EMAIL}" && -n "${CLIENT_PASSWORD}" ]]; then
  echo "== Step 4: login as client and submit a response"
  curl -i -s -X POST "${API_BASE}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${CLIENT_EMAIL}\",\"password\":\"${CLIENT_PASSWORD}\"}" \
    -c "${COOKIE_CLIENT}" >/tmp/bs-client-login.headers
  echo "$(head -n 1 /tmp/bs-client-login.headers || true)"

  RESPONSE_ID="$(curl -s -b "${COOKIE_CLIENT}" -H "Content-Type: application/json" -X POST "${API_BASE}/responses/submit" -d "{
    \"assignmentId\": \"${ASSIGNMENT_ID}\",
    \"mood\": 5,
    \"text\": \"Smoke test response for library-based assignment.\"
  }" | node -e '
    const fs = require("fs");
    const input = fs.readFileSync(0, "utf8");
    const data = JSON.parse(input || "{}");
    process.stdout.write(data?.id || "");
  ')"
  echo "RESPONSE_ID=${RESPONSE_ID}"
else
  echo "== Step 4: client response submission skipped (set CLIENT_EMAIL + CLIENT_PASSWORD to enable)"
fi

if [[ -n "${THERAPIST_EMAIL}" && -n "${THERAPIST_PASSWORD}" && -n "${RESPONSE_ID}" ]]; then
  echo "== Step 5: login as therapist and mark response reviewed"
  curl -i -s -X POST "${API_BASE}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${THERAPIST_EMAIL}\",\"password\":\"${THERAPIST_PASSWORD}\"}" \
    -c "${COOKIE_THERAPIST}" >/tmp/bs-therapist-login.headers
  echo "$(head -n 1 /tmp/bs-therapist-login.headers || true)"

  curl -i -s -b "${COOKIE_THERAPIST}" -H "Content-Type: application/json" -X PATCH \
    "${API_BASE}/responses/therapist/${RESPONSE_ID}/review" \
    -d "{\"therapistNote\":\"Reviewed in smoke test\"}" >/tmp/bs-review.headers
  echo "$(head -n 1 /tmp/bs-review.headers || true)"
else
  echo "== Step 5: clinician review skipped (set THERAPIST_EMAIL + THERAPIST_PASSWORD and ensure RESPONSE_ID exists)"
fi

echo "== Step 6: fetch AER JSON and assert library_source exists"
AER_JSON="$(curl -s -b "${COOKIE_ADMIN}" "${API_BASE}/reports/aer/${CLINIC_ID}/${CLIENT_ID}?start=${START}&end=${END}")"
echo "${AER_JSON}" | node -e '
  const fs = require("fs");
  const data = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  const list = Array.isArray(data.prescribed_interventions) ? data.prescribed_interventions : [];
  const linked = list.filter((x) => x && x.library_source && x.library_source.item_id);
  if (linked.length === 0) {
    console.error("FAIL: No library_source found in prescribed_interventions.");
    process.exit(2);
  }
  console.log("OK: library_source present. Example:", {
    assignment_id: linked[0].assignment_id,
    library_source: linked[0].library_source,
    completed_at: linked[0].completed_at ?? null,
    reviewed_at: linked[0].reviewed_at ?? null,
  });
'

echo "== Step 7: fetch AER PDF and confirm 200"
curl -s -D /tmp/bs-aer-pdf.headers \
  -b "${COOKIE_ADMIN}" \
  "${API_BASE}/reports/aer/${CLINIC_ID}/${CLIENT_ID}.pdf?start=${START}&end=${END}" \
  -o /tmp/bs-aer.pdf

head -n 1 /tmp/bs-aer-pdf.headers || true
grep -iE "^content-type:|^content-length:" /tmp/bs-aer-pdf.headers || true
ls -lh /tmp/bs-aer.pdf || true

echo "DONE"
