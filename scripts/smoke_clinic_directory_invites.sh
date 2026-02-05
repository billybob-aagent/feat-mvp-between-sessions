#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000/api/v1}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/bs-cookie-admin.txt}"

if [[ -z "${CLINIC_ADMIN_EMAIL:-}" || -z "${CLINIC_ADMIN_PASSWORD:-}" ]]; then
  echo "Set CLINIC_ADMIN_EMAIL and CLINIC_ADMIN_PASSWORD to run this script."
  exit 1
fi

CLINIC_QS=""
CLINIC_BODY=""
if [[ -n "${CLINIC_ID:-}" ]]; then
  CLINIC_QS="clinicId=${CLINIC_ID}"
  CLINIC_BODY="\"clinicId\":\"${CLINIC_ID}\","
fi

echo "== Step 1: login as clinic admin (cookie)"
curl -i -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${CLINIC_ADMIN_EMAIL}\",\"password\":\"${CLINIC_ADMIN_PASSWORD}\"}" \
  -c "${COOKIE_JAR}" | head -n 1

echo "== Step 2: list therapists"
curl -s -b "${COOKIE_JAR}" "${BASE_URL}/clinic/therapists?${CLINIC_QS}" | jq '{count: (.items | length), sample: (.items[0:3])}'

echo "== Step 3: list clients"
curl -s -b "${COOKIE_JAR}" "${BASE_URL}/clinic/clients?${CLINIC_QS}" | jq '{count: (.items | length), sample: (.items[0:3])}'

THERAPIST_ID="${THERAPIST_ID:-}"
if [[ -z "${THERAPIST_ID}" ]]; then
  THERAPIST_ID=$(curl -s -b "${COOKIE_JAR}" "${BASE_URL}/clinic/therapists?${CLINIC_QS}" | jq -r '.items[0].id // empty')
fi

if [[ -n "${INVITE_THERAPIST_EMAIL:-}" ]]; then
  echo "== Step 4: invite therapist"
  curl -s -b "${COOKIE_JAR}" -X POST "${BASE_URL}/clinic/therapists/invite" \
    -H "Content-Type: application/json" \
    -d "{${CLINIC_BODY}\"email\":\"${INVITE_THERAPIST_EMAIL}\"}" | jq '.'
fi

if [[ -n "${INVITE_CLIENT_EMAIL:-}" ]]; then
  echo "== Step 5: invite client"
  if [[ -z "${THERAPIST_ID}" ]]; then
    echo "No therapist available to assign. Set THERAPIST_ID and re-run."
    exit 1
  fi
  curl -s -b "${COOKIE_JAR}" -X POST "${BASE_URL}/clinic/clients/invite" \
    -H "Content-Type: application/json" \
    -d "{${CLINIC_BODY}\"email\":\"${INVITE_CLIENT_EMAIL}\",\"therapistId\":\"${THERAPIST_ID}\"}" | jq '.'
fi

echo "== Done"
