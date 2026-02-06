#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000/api/v1}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/bs-cookie-pilot-admin.txt}"

CLINIC_ID="${CLINIC_ID:-}"
START="${START:-}"
END="${END:-}"

CLINIC_ADMIN_EMAIL="${CLINIC_ADMIN_EMAIL:-pilot-admin@betweensessions.local}"
CLINIC_ADMIN_PASSWORD="${CLINIC_ADMIN_PASSWORD:-ChangeMeAdmin1!}"

if [[ -z "${CLINIC_ID}" ]]; then
  echo "Set CLINIC_ID to run this script."; exit 1; fi

if [[ -z "${START}" || -z "${END}" ]]; then
  TODAY=$(date +%Y-%m-%d)
  START=$(date -v-7d +%Y-%m-%d)
  END=${TODAY}
fi

echo "== Step 1: login as clinic admin"
LOGIN_STATUS=$(curl -i -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${CLINIC_ADMIN_EMAIL}\",\"password\":\"${CLINIC_ADMIN_PASSWORD}\"}" \
  -c "${COOKIE_JAR}" | head -n 1)

echo "${LOGIN_STATUS}"
if [[ "${LOGIN_STATUS}" != *"200"* && "${LOGIN_STATUS}" != *"201"* ]]; then
  echo "Clinic admin login failed."; exit 1; fi

echo "== Step 2: fetch pilot metrics"
METRICS_JSON=$(curl -s -b "${COOKIE_JAR}" "${BASE_URL}/metrics/pilot/${CLINIC_ID}?start=${START}&end=${END}")

node -e '
  const fs = require("fs");
  const data = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  const required = [
    "review_throughput",
    "aer_usage",
    "ai_usage",
    "operational",
  ];
  const missing = required.filter((k) => !(k in data));
  if (missing.length) {
    console.error("Missing keys:", missing.join(", "));
    process.exit(2);
  }
  console.log("OK: metrics payload contains required keys.");
' <<< "${METRICS_JSON}"

echo "== Done"
