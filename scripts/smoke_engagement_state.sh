#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000}"
API_BASE="${BASE_URL%/}/api/v1"

COOKIE_ADMIN="/tmp/bs-cookie-admin-engagement.txt"
COOKIE_THERAPIST="/tmp/bs-cookie-therapist-engagement.txt"
COOKIE_CLIENT="/tmp/bs-cookie-client-engagement.txt"

CLINIC_ADMIN_EMAIL="${CLINIC_ADMIN_EMAIL:-pilot-admin@betweensessions.local}"
CLINIC_ADMIN_PASSWORD="${CLINIC_ADMIN_PASSWORD:-ChangeMeAdmin1!}"
THERAPIST_PASSWORD="${THERAPIST_PASSWORD:-ChangeMeTherapist1!}"
CLIENT_PASSWORD="${CLIENT_PASSWORD:-ChangeMeClient1!}"

sha256_file() {
  local file="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "${file}" | awk '{print $1}'
    return 0
  fi
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${file}" | awk '{print $1}'
    return 0
  fi
  echo "sha256 tool not found (need shasum or sha256sum)" >&2
  return 1
}

echo "== Step 0: ensure a published library item exists"
if [[ -f backend/.env ]]; then
  set -a
  source backend/.env
  set +a
fi

node - <<'NODE'
const fs = require("fs");
const path = require("path");
const envPath = path.join(process.cwd(), "backend", ".env");

if (!process.env.DATABASE_URL && fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf8");
  for (const line of envText.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (match) process.env[match[1]] = match[2];
  }
}

const { PrismaClient } = require("./backend/node_modules/@prisma/client");
const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL not set (needed to seed library items).");
  }

  let clinic = await prisma.clinics.findFirst({
    where: { name: "Pilot Clinic" },
    orderBy: { created_at: "asc" },
  });
  if (!clinic) {
    clinic = await prisma.clinics.create({
      data: { name: "Pilot Clinic", timezone: "UTC" },
    });
  }

  const existing = await prisma.library_items.findFirst({
    where: { clinic_id: clinic.id, status: "PUBLISHED" },
  });
  if (existing) {
    console.log("Published library item already exists.");
    return;
  }

  let collection = await prisma.library_collections.findFirst({
    where: { clinic_id: clinic.id, title: "Pilot Seed Collection" },
  });
  if (!collection) {
    collection = await prisma.library_collections.create({
      data: {
        clinic_id: clinic.id,
        title: "Pilot Seed Collection",
        description: "Seeded for smoke engagement script",
      },
    });
  }

  const metadata = {
    contentType: "Form",
    primaryClinicalDomains: [],
    applicableModalities: [],
    targetPopulation: [],
    clinicalSetting: [],
    clinicalComplexityLevel: null,
    sessionUse: null,
    evidenceBasis: null,
    customizationRequired: { required: false, notes: null },
  };

  const sections = [
    {
      headingPath: "Pilot Seed Collection > Sample Assignment > Overview",
      title: "Overview",
      text: "Seeded client section for smoke test.",
      sectionType: "Overview",
      audience: "Client",
    },
    {
      headingPath: "Pilot Seed Collection > Sample Assignment > Clinician Notes",
      title: "Clinician Notes",
      text: "Seeded clinician notes for smoke test.",
      sectionType: "Clinician Notes",
      audience: "Clinician",
    },
  ];

  const item = await prisma.library_items.create({
    data: {
      clinic_id: clinic.id,
      collection_id: collection.id,
      slug: "pilot-seed-item",
      title: "Sample Assignment",
      content_type: "Form",
      metadata,
      sections,
      status: "PUBLISHED",
      version: 1,
      source_file_name: "seeded",
      import_timestamp: new Date(0),
    },
  });

  await prisma.library_item_versions.create({
    data: {
      item_id: item.id,
      version_number: 1,
      metadata_snapshot: metadata,
      sections_snapshot: sections,
      change_summary: "Seeded for smoke engagement script",
    },
  });

  console.log(`Seeded minimal library item ${item.id}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
NODE

echo "== Step 1: run pilot seed (for known clinic/admin/therapist)"
SEED_LOG=$(mktemp)
npm --prefix backend run pilot:seed | tee "${SEED_LOG}"
SEED_JSON=$(sed -n 's/^PILOT_SEED_RESULT=//p' "${SEED_LOG}" | tail -n 1)

if [[ -z "${SEED_JSON}" ]]; then
  echo "Seed output missing PILOT_SEED_RESULT."; exit 1; fi

CLINIC_ID=$(echo "${SEED_JSON}" | node -e 'const fs = require("fs"); const data = JSON.parse(fs.readFileSync(0, "utf8")); process.stdout.write(data.clinicId || "");')
THERAPIST_EMAIL=$(echo "${SEED_JSON}" | node -e 'const fs = require("fs"); const data = JSON.parse(fs.readFileSync(0, "utf8")); process.stdout.write(data.therapistEmail || "");')

if [[ -z "${CLINIC_ID}" || -z "${THERAPIST_EMAIL}" ]]; then
  echo "Seed output missing clinicId or therapistEmail."; exit 1; fi

echo "CLINIC_ID=${CLINIC_ID}"
echo "THERAPIST_EMAIL=${THERAPIST_EMAIL}"

echo "== Step 2: login as clinic admin"
ADMIN_STATUS=$(curl -i -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${CLINIC_ADMIN_EMAIL}\",\"password\":\"${CLINIC_ADMIN_PASSWORD}\"}" \
  -c "${COOKIE_ADMIN}" | head -n 1)

echo "${ADMIN_STATUS}"
if [[ "${ADMIN_STATUS}" != *"200"* && "${ADMIN_STATUS}" != *"201"* ]]; then
  echo "Clinic admin login failed."; exit 1; fi

echo "== Step 3: fetch a client for the clinic"
CLIENT_JSON=$(curl -s -b "${COOKIE_ADMIN}" "${API_BASE}/clinic/clients?limit=1")
CLIENT_ID=$(echo "${CLIENT_JSON}" | node -e 'const fs = require("fs"); const data = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); const first = Array.isArray(data.items) ? data.items[0] : null; process.stdout.write(first?.id || "");')
CLIENT_EMAIL=$(echo "${CLIENT_JSON}" | node -e 'const fs = require("fs"); const data = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); const first = Array.isArray(data.items) ? data.items[0] : null; process.stdout.write(first?.email || "");')

if [[ -z "${CLIENT_ID}" || -z "${CLIENT_EMAIL}" ]]; then
  echo "No client found for clinic."; exit 1; fi

echo "CLIENT_ID=${CLIENT_ID}"
echo "CLIENT_EMAIL=${CLIENT_EMAIL}"

echo "== Step 4: login as therapist"
THERAPIST_STATUS=$(curl -i -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${THERAPIST_EMAIL}\",\"password\":\"${THERAPIST_PASSWORD}\"}" \
  -c "${COOKIE_THERAPIST}" | head -n 1)

echo "${THERAPIST_STATUS}"
if [[ "${THERAPIST_STATUS}" != *"200"* && "${THERAPIST_STATUS}" != *"201"* ]]; then
  echo "Therapist login failed."; exit 1; fi

echo "== Step 5: create prompt"
PROMPT_ID=$(curl -s -b "${COOKIE_THERAPIST}" -H "Content-Type: application/json" -X POST "${API_BASE}/prompts/create" -d '{
  "title": "Engagement smoke prompt",
  "content": "Share a brief check-in for engagement smoke test."
}' | node -e 'const fs = require("fs"); const data = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); process.stdout.write(data?.id || "");')

if [[ -z "${PROMPT_ID}" ]]; then
  echo "Prompt creation failed."; exit 1; fi

echo "PROMPT_ID=${PROMPT_ID}"

echo "== Step 6: create assignment (due date in the past to force overdue)"
PAST_DUE=$(node -e 'const d=new Date(); d.setUTCDate(d.getUTCDate()-8); console.log(d.toISOString().slice(0,10));')
ASSIGNMENT_ID=$(curl -s -b "${COOKIE_THERAPIST}" -H "Content-Type: application/json" -X POST "${API_BASE}/assignments/create" -d "{\"clientId\":\"${CLIENT_ID}\",\"promptId\":\"${PROMPT_ID}\",\"dueDate\":\"${PAST_DUE}\"}" | node -e 'const fs = require("fs"); const data = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); process.stdout.write(data?.id || "");')

if [[ -z "${ASSIGNMENT_ID}" ]]; then
  echo "Assignment creation failed."; exit 1; fi

echo "ASSIGNMENT_ID=${ASSIGNMENT_ID}"

echo "== Step 7: login as client"
CLIENT_STATUS=$(curl -i -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${CLIENT_EMAIL}\",\"password\":\"${CLIENT_PASSWORD}\"}" \
  -c "${COOKIE_CLIENT}" | head -n 1)

echo "${CLIENT_STATUS}"
if [[ "${CLIENT_STATUS}" != *"200"* && "${CLIENT_STATUS}" != *"201"* ]]; then
  echo "Client login failed."; exit 1; fi

echo "== Step 8: submit partial response"
RESPONSE_ID=$(curl -s -b "${COOKIE_CLIENT}" -H "Content-Type: application/json" -X POST "${API_BASE}/responses/submit" -d "{\"assignmentId\":\"${ASSIGNMENT_ID}\",\"mood\":5,\"text\":\"Partial check-in for smoke test.\",\"completionStatus\":\"partial\"}" | node -e 'const fs = require("fs"); const data = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); process.stdout.write(data?.id || "");')

if [[ -z "${RESPONSE_ID}" ]]; then
  echo "Response submission failed."; exit 1; fi

echo "RESPONSE_ID=${RESPONSE_ID}"

echo "== Step 9: run engagement automation"
npm --prefix backend run engagement:cycle -- --assignment-id "${ASSIGNMENT_ID}"

echo "== Step 10: verify escalation created"
ESCALATIONS_JSON=$(curl -s -b "${COOKIE_ADMIN}" "${API_BASE}/supervisor-actions/escalations/${CLINIC_ID}?status=OPEN&limit=50")
ESCALATION_ID=$(echo "${ESCALATIONS_JSON}" | ASSIGNMENT_ID="${ASSIGNMENT_ID}" node -e '
  const fs = require("fs");
  const data = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const match = rows.find((row) => row.sourceAssignmentId === process.env.ASSIGNMENT_ID);
  process.stdout.write(match?.id || "");
')

if [[ -z "${ESCALATION_ID}" ]]; then
  echo "No escalation found for assignment."; exit 1; fi

echo "ESCALATION_ID=${ESCALATION_ID}"

echo "== Step 11: generate AER JSON twice and confirm deterministic hashes"
START=$(node -e 'const d=new Date(); d.setUTCDate(d.getUTCDate()-10); console.log(d.toISOString().slice(0,10));')
END=$(node -e 'const d=new Date(); console.log(d.toISOString().slice(0,10));')

curl -s -b "${COOKIE_ADMIN}" "${API_BASE}/reports/aer/${CLINIC_ID}/${CLIENT_ID}?start=${START}&end=${END}" -o /tmp/bs-aer-engagement-1.json
curl -s -b "${COOKIE_ADMIN}" "${API_BASE}/reports/aer/${CLINIC_ID}/${CLIENT_ID}?start=${START}&end=${END}" -o /tmp/bs-aer-engagement-2.json

JSON_HASH_1=$(sha256_file /tmp/bs-aer-engagement-1.json)
JSON_HASH_2=$(sha256_file /tmp/bs-aer-engagement-2.json)

echo "AER JSON hash 1: ${JSON_HASH_1}"
echo "AER JSON hash 2: ${JSON_HASH_2}"
if [[ "${JSON_HASH_1}" != "${JSON_HASH_2}" ]]; then
  echo "AER JSON hashes do not match."; exit 1; fi

echo "== Step 12: generate AER PDF twice and confirm deterministic hashes"

curl -s -b "${COOKIE_ADMIN}" "${API_BASE}/reports/aer/${CLINIC_ID}/${CLIENT_ID}.pdf?start=${START}&end=${END}" -o /tmp/bs-aer-engagement-1.pdf
curl -s -b "${COOKIE_ADMIN}" "${API_BASE}/reports/aer/${CLINIC_ID}/${CLIENT_ID}.pdf?start=${START}&end=${END}" -o /tmp/bs-aer-engagement-2.pdf

PDF_HASH_1=$(sha256_file /tmp/bs-aer-engagement-1.pdf)
PDF_HASH_2=$(sha256_file /tmp/bs-aer-engagement-2.pdf)

echo "AER PDF hash 1: ${PDF_HASH_1}"
echo "AER PDF hash 2: ${PDF_HASH_2}"
if [[ "${PDF_HASH_1}" != "${PDF_HASH_2}" ]]; then
  echo "AER PDF hashes do not match."; exit 1; fi

echo "== Done"
