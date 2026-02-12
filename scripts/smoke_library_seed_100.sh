#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:4000}"
API_BASE="${BASE_URL%/}/api/v1"

COOKIE_ADMIN="/tmp/bs-cookie-admin-library.txt"

CLINIC_ADMIN_EMAIL="${CLINIC_ADMIN_EMAIL:-pilot-admin@betweensessions.local}"
CLINIC_ADMIN_PASSWORD="${CLINIC_ADMIN_PASSWORD:-ChangeMeAdmin1!}"

SEED_LOG=$(mktemp)

echo "== Step 1: run pilot seed"
npm --prefix backend run pilot:seed | tee "${SEED_LOG}"
SEED_JSON=$(sed -n 's/^PILOT_SEED_RESULT=//p' "${SEED_LOG}" | tail -n 1)

if [[ -z "${SEED_JSON}" ]]; then
  echo "Seed output missing PILOT_SEED_RESULT."; exit 1; fi

CLINIC_ID=$(echo "${SEED_JSON}" | node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(d.clinicId||"");')
CLIENT_ID=$(echo "${SEED_JSON}" | node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(d.clientId||"");')

if [[ -z "${CLINIC_ID}" || -z "${CLIENT_ID}" ]]; then
  echo "Seed output missing clinicId or clientId."; exit 1; fi

echo "CLINIC_ID=${CLINIC_ID}"
echo "CLIENT_ID=${CLIENT_ID}"


echo "== Step 2: login as clinic admin"
ADMIN_STATUS=$(curl -i -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${CLINIC_ADMIN_EMAIL}\",\"password\":\"${CLINIC_ADMIN_PASSWORD}\"}" \
  -c "${COOKIE_ADMIN}" | head -n 1)

echo "${ADMIN_STATUS}"
if [[ "${ADMIN_STATUS}" != *"200"* && "${ADMIN_STATUS}" != *"201"* ]]; then
  echo "Clinic admin login failed."; exit 1; fi


echo "== Step 3: ingest starter pack"
INGEST=$(curl -s -b "${COOKIE_ADMIN}" -X POST "${API_BASE}/library/admin/ingest-starter-pack" \
  -H "Content-Type: application/json" \
  -d "{}")

echo "${INGEST}" | node -e '
  const fs = require("fs");
  const data = JSON.parse(fs.readFileSync(0,"utf8") || "{}");
  if (!data.ok) throw new Error("Ingest failed");
  const total = (data.created_items||0) + (data.updated_items||0) + (data.skipped_same_checksum||0);
  if (total !== 100) throw new Error(`Expected 100 items processed, got ${total}`);
'


echo "== Step 4: list draft library items"
DRAFT_ITEMS=$(curl -s -b "${COOKIE_ADMIN}" "${API_BASE}/library/items?status=draft")
DRAFT_COUNT=$(echo "${DRAFT_ITEMS}" | node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(String(Array.isArray(d)?d.length:0));')

if [[ "${DRAFT_COUNT}" -lt 100 ]]; then
  echo "Expected at least 100 draft items, got ${DRAFT_COUNT}."; exit 1; fi

DRAFT_ITEM_ID=$(echo "${DRAFT_ITEMS}" | node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(d[0]?.id||"");')
if [[ -z "${DRAFT_ITEM_ID}" ]]; then
  echo "No draft item id found."; exit 1; fi

echo "DRAFT_ITEM_ID=${DRAFT_ITEM_ID}"


echo "== Step 5: ensure draft item cannot be assigned from library"
ASSIGN_STATUS=$(curl -i -s -o /tmp/library_assign_draft.json -w "%{http_code}" \
  -X POST "${API_BASE}/assignments/from-library" \
  -H "Content-Type: application/json" \
  -b "${COOKIE_ADMIN}" \
  -d "{\"clinicId\":\"${CLINIC_ID}\",\"clientId\":\"${CLIENT_ID}\",\"libraryItemId\":\"${DRAFT_ITEM_ID}\"}")

if [[ "${ASSIGN_STATUS}" == "201" ]]; then
  echo "Draft item assignment unexpectedly succeeded."; exit 1; fi


echo "== Step 6: publish one item"
PUBLISH_STATUS=$(curl -i -s -X POST "${API_BASE}/library/items/${DRAFT_ITEM_ID}/publish" \
  -H "Content-Type: application/json" \
  -b "${COOKIE_ADMIN}" \
  -d "{}" | head -n 1)

echo "${PUBLISH_STATUS}"
if [[ "${PUBLISH_STATUS}" != *"200"* && "${PUBLISH_STATUS}" != *"201"* ]]; then
  echo "Publish failed."; exit 1; fi


echo "== Step 7: assign published item"
ASSIGN_OK=$(curl -s -X POST "${API_BASE}/assignments/from-library" \
  -H "Content-Type: application/json" \
  -b "${COOKIE_ADMIN}" \
  -d "{\"clinicId\":\"${CLINIC_ID}\",\"clientId\":\"${CLIENT_ID}\",\"libraryItemId\":\"${DRAFT_ITEM_ID}\"}")

echo "${ASSIGN_OK}" | node -e '
  const fs=require("fs");
  const data=JSON.parse(fs.readFileSync(0,"utf8")||"{}");
  if (!data.id) throw new Error("Assignment create failed");
  if (!data.library_source || data.library_source.status !== "PUBLISHED") throw new Error("Missing library_source linkage");
';

echo "== Done"
