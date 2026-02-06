#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000/api/v1}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/bs-cookie-pilot-admin.txt}"

CLINIC_ADMIN_EMAIL="${CLINIC_ADMIN_EMAIL:-pilot-admin@betweensessions.local}"
CLINIC_ADMIN_PASSWORD="${CLINIC_ADMIN_PASSWORD:-ChangeMeAdmin1!}"

if [[ -z "${CLINIC_ADMIN_EMAIL}" || -z "${CLINIC_ADMIN_PASSWORD}" ]]; then
  echo "Set CLINIC_ADMIN_EMAIL and CLINIC_ADMIN_PASSWORD to run this script."
  exit 1
fi

echo "== Step 1: run pilot seed"
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

if [[ -z "${CLINIC_ID}" ]]; then
  echo "Seed output missing clinicId."
  exit 1
fi

echo "CLINIC_ID=${CLINIC_ID}"

echo "== Step 2: login as clinic admin"
LOGIN_STATUS=$(curl -i -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${CLINIC_ADMIN_EMAIL}\",\"password\":\"${CLINIC_ADMIN_PASSWORD}\"}" \
  -c "${COOKIE_JAR}" | head -n 1)

echo "${LOGIN_STATUS}"
if [[ "${LOGIN_STATUS}" != *"200"* && "${LOGIN_STATUS}" != *"201"* ]]; then
  echo "Clinic admin login failed."
  exit 1
fi

echo "== Step 3: confirm clinic dashboard"
DASH_JSON=$(curl -s -b "${COOKIE_JAR}" "${BASE_URL}/clinic/dashboard")
DASH_CLINIC_ID=$(echo "${DASH_JSON}" | node -e '
  const fs = require("fs");
  const data = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  process.stdout.write(data?.clinic?.id || "");
')

if [[ -z "${DASH_CLINIC_ID}" ]]; then
  echo "Clinic dashboard missing clinic ID."; exit 1; fi

echo "Dashboard clinic ID: ${DASH_CLINIC_ID}"

echo "== Step 4: verify reviewed responses exist"
REVIEWED_COUNT=$(curl -s -b "${COOKIE_JAR}" "${BASE_URL}/clinic/responses?reviewed=reviewed&limit=1" | node -e '
  const fs = require("fs");
  const data = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  process.stdout.write(String(Array.isArray(data.items) ? data.items.length : 0));
')

echo "Reviewed responses (sample size): ${REVIEWED_COUNT}"
if [[ "${REVIEWED_COUNT}" == "0" ]]; then
  echo "No reviewed responses found."; exit 1; fi

echo "== Done"
