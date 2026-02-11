#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:4000}"
API_BASE="${BASE_URL%/}/api/v1"

COOKIE_ADMIN="/tmp/bs-cookie-admin-metrics.txt"
COOKIE_THERAPIST="/tmp/bs-cookie-therapist-metrics.txt"

CLINIC_ADMIN_EMAIL="${CLINIC_ADMIN_EMAIL:-pilot-admin@betweensessions.local}"
CLINIC_ADMIN_PASSWORD="${CLINIC_ADMIN_PASSWORD:-ChangeMeAdmin1!}"
THERAPIST_PASSWORD="${THERAPIST_PASSWORD:-ChangeMeTherapist1!}"

echo "== Step 0: ensure a published library item exists"
pushd backend > /dev/null
node -e 'const fs=require("fs"); const path=require("path"); const envPath=path.join(process.cwd(),".env"); if(!process.env.DATABASE_URL && fs.existsSync(envPath)){ const envText=fs.readFileSync(envPath,"utf8"); for(const line of envText.split("\\n")){ const match=line.match(/^\\s*([A-Z0-9_]+)\\s*=\\s*"?([^"]*)"?\\s*$/); if(match) process.env[match[1]]=match[2]; } } const {PrismaClient}=require("@prisma/client"); const prisma=new PrismaClient(); async function main(){ if(!process.env.DATABASE_URL){ throw new Error("DATABASE_URL not set (needed to seed library items)."); } let clinic=await prisma.clinics.findFirst({ where:{ name:"Pilot Clinic"}, orderBy:{ created_at:"asc"} }); if(!clinic){ clinic=await prisma.clinics.create({ data:{ name:"Pilot Clinic", timezone:"UTC"} }); } const existing=await prisma.library_items.findFirst({ where:{ clinic_id:clinic.id, status:"PUBLISHED"} }); if(existing){ console.log("Published library item already exists."); return; } let collection=await prisma.library_collections.findFirst({ where:{ clinic_id:clinic.id, title:"Pilot Seed Collection"} }); if(!collection){ collection=await prisma.library_collections.create({ data:{ clinic_id:clinic.id, title:"Pilot Seed Collection", description:"Seeded for smoke metrics script"} }); } const metadata={ contentType:"Form", primaryClinicalDomains:[], applicableModalities:[], targetPopulation:[], clinicalSetting:[], clinicalComplexityLevel:null, sessionUse:null, evidenceBasis:null, customizationRequired:{ required:false, notes:null } }; const sections=[{ headingPath:"Pilot Seed Collection > Sample Assignment > Overview", title:"Overview", text:"Seeded client section for smoke metrics test.", sectionType:"Overview", audience:"Client" }]; const item=await prisma.library_items.create({ data:{ clinic_id:clinic.id, collection_id:collection.id, slug:"pilot-seed-item", title:"Sample Assignment", content_type:"Form", metadata, sections, status:"PUBLISHED", version:1, source_file_name:"seeded", import_timestamp:new Date(0) } }); await prisma.library_item_versions.create({ data:{ item_id:item.id, version_number:1, metadata_snapshot:metadata, sections_snapshot:sections, change_summary:"Seeded for smoke metrics script" } }); console.log("Seeded minimal library item " + item.id + "."); } main().catch((error)=>{ console.error(error); process.exitCode=1; }).finally(async()=>{ await prisma.$disconnect(); });'
popd > /dev/null

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

echo "== Step 3: login as therapist"
THERAPIST_STATUS=$(curl -i -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${THERAPIST_EMAIL}\",\"password\":\"${THERAPIST_PASSWORD}\"}" \
  -c "${COOKIE_THERAPIST}" | head -n 1)

echo "${THERAPIST_STATUS}"
if [[ "${THERAPIST_STATUS}" != *"200"* && "${THERAPIST_STATUS}" != *"201"* ]]; then
  echo "Therapist login failed."; exit 1; fi

START=$(node -e 'const d=new Date(); d.setUTCDate(d.getUTCDate()-10); console.log(d.toISOString().slice(0,10));')
END=$(node -e 'const d=new Date(); console.log(d.toISOString().slice(0,10));')

echo "== Step 4: fetch clinic metrics"
CLINIC_METRICS=$(curl -s -b "${COOKIE_ADMIN}" "${API_BASE}/metrics/clinic/${CLINIC_ID}?start=${START}&end=${END}")

echo "${CLINIC_METRICS}" | node -e '
  const fs = require("fs");
  const data = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  if (!data.ok) throw new Error("Clinic metrics not ok");
  if (!data.summary) throw new Error("Missing summary");
  const keys = [
    "reviewed_responses_count",
    "median_time_to_review_hours",
    "review_backlog_count",
    "assignment_completion_rate",
    "overdue_rate",
    "escalation_open_count",
    "escalation_median_time_to_resolve_hours",
    "aer_generated_count",
  ];
  for (const key of keys) {
    if (!(key in data.summary)) throw new Error(`Missing ${key}`);
    const value = data.summary[key];
    if (typeof value === "number" && value < 0) throw new Error(`Negative ${key}`);
  }
  if (data.summary.assignment_completion_rate !== null && data.summary.assignment_completion_rate > 1) {
    throw new Error("Completion rate > 1");
  }
  if (data.summary.overdue_rate !== null && data.summary.overdue_rate > 1) {
    throw new Error("Overdue rate > 1");
  }
'

echo "== Step 5: fetch therapist metrics"
THERAPIST_METRICS=$(curl -s -b "${COOKIE_THERAPIST}" "${API_BASE}/metrics/therapist/${CLINIC_ID}?start=${START}&end=${END}")

echo "${THERAPIST_METRICS}" | node -e '
  const fs = require("fs");
  const data = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  if (!data.ok) throw new Error("Therapist metrics not ok");
  if (!data.summary) throw new Error("Missing summary");
  if (data.summary.reviewed_responses_count < 0) throw new Error("Negative reviewed_responses_count");
'

echo "== Step 6: fetch clinic metrics series"
CLINIC_SERIES=$(curl -s -b "${COOKIE_ADMIN}" "${API_BASE}/metrics/clinic/${CLINIC_ID}/series?start=${START}&end=${END}&bucket=week")

echo "${CLINIC_SERIES}" | node -e '
  const fs = require("fs");
  const data = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  if (!data.ok) throw new Error("Series not ok");
  if (!data.series || !Array.isArray(data.series.points)) throw new Error("Missing series points");
  for (const point of data.series.points) {
    const keys = [
      "bucket_start",
      "reviewed_responses_count",
      "review_backlog_count",
      "assignment_completion_rate",
      "overdue_rate",
      "escalation_open_count",
    ];
    for (const key of keys) {
      if (!(key in point)) throw new Error(`Missing ${key} in series point`);
    }
    if (point.reviewed_responses_count < 0 || point.review_backlog_count < 0 || point.escalation_open_count < 0) {
      throw new Error("Negative series values");
    }
  }
'

echo "== Done"
