#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: bash scripts/pilot_simulation_v1.sh [options]

Options:
  --out <dir>                  Output root for pilot packets (default: pilot_packets)
  --profile <IOP|PHP|MAT|GENERIC>  Submission profile (default: IOP)
  --period-days <N>            Period length in days (default: 7)
  --include-external-links     Include external links in submission bundle (admin only)
  --start-backend              Start backend (npm --prefix backend run start:dev)
  --start-frontend             Start frontend (npm --prefix frontend run dev)
  --no-frontend-build          Skip frontend build when starting frontend
  --seed-suffix <suffix>       Suffix for clinic/email seed (default: YYYYMMDD)
USAGE
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

BASE_URL="${BASE_URL:-http://localhost:4000/api/v1}"
OUT_DIR="${OUT_DIR:-pilot_packets}"
PROFILE="IOP"
PERIOD_DAYS="7"
INCLUDE_EXTERNAL_LINKS="false"
START_BACKEND="false"
START_FRONTEND="false"
NO_FRONTEND_BUILD="false"
SEED_SUFFIX=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out)
      OUT_DIR="$2"
      shift 2
      ;;
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --period-days)
      PERIOD_DAYS="$2"
      shift 2
      ;;
    --include-external-links)
      INCLUDE_EXTERNAL_LINKS="true"
      shift
      ;;
    --start-backend)
      START_BACKEND="true"
      shift
      ;;
    --start-frontend)
      START_FRONTEND="true"
      shift
      ;;
    --no-frontend-build)
      NO_FRONTEND_BUILD="true"
      shift
      ;;
    --seed-suffix)
      SEED_SUFFIX="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

PROFILE="$(echo "${PROFILE}" | tr '[:lower:]' '[:upper:]')"
if [[ "${PROFILE}" != "IOP" && "${PROFILE}" != "PHP" && "${PROFILE}" != "MAT" && "${PROFILE}" != "GENERIC" ]]; then
  echo "Invalid profile: ${PROFILE}" >&2
  exit 1
fi

if [[ ! "${BASE_URL}" =~ ^https?://(localhost|127\.0\.0\.1) ]]; then
  echo "BASE_URL must be localhost. Received: ${BASE_URL}" >&2
  exit 1
fi

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  if [[ -n "${BACKEND_PID}" ]]; then
    kill "${BACKEND_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${FRONTEND_PID}" ]]; then
    kill "${FRONTEND_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ "${START_BACKEND}" == "true" ]]; then
  echo "Starting backend..."
  npm --prefix backend run start:dev >/tmp/pilot_backend.log 2>&1 &
  BACKEND_PID=$!
fi

if [[ "${START_FRONTEND}" == "true" ]]; then
  if [[ "${NO_FRONTEND_BUILD}" != "true" ]]; then
    echo "Building frontend..."
    npm --prefix frontend run build
  fi
  echo "Starting frontend..."
  npm --prefix frontend run dev >/tmp/pilot_frontend.log 2>&1 &
  FRONTEND_PID=$!
fi

if ! curl -s --connect-timeout 5 "${BASE_URL}/auth/login" -o /dev/null; then
  echo "Backend not reachable at ${BASE_URL}." >&2
  echo "Start it with: npm --prefix backend run start:dev" >&2
  echo "Or rerun with: --start-backend" >&2
  exit 1
fi

if [[ -z "${SEED_SUFFIX}" ]]; then
  SEED_SUFFIX="$(date +%Y%m%d)"
fi

END_DATE="$(node -e 'const d=new Date(); d.setHours(0,0,0,0); console.log(d.toISOString().slice(0,10));')"
START_DATE="$(node -e 'const days=Number(process.argv[1]||"7"); const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-(days-1)); console.log(d.toISOString().slice(0,10));' "${PERIOD_DAYS}")"

CLINIC_NAME="Pilot Clinic ${SEED_SUFFIX}"
CLINIC_ADMIN_EMAIL="pilot-admin-${SEED_SUFFIX}@betweensessions.local"
CLINIC_ADMIN_PASSWORD="ChangeMeAdmin1!"
THERAPIST_EMAIL="pilot-therapist-${SEED_SUFFIX}@betweensessions.local"
THERAPIST_PASSWORD="ChangeMeTherapist1!"
THERAPIST_NAME="Pilot Therapist"
CLIENT_PASSWORD="ChangeMeClient1!"

echo "== Step 1: seed pilot clinic"
SEED_LOG=$(mktemp)
CLINIC_NAME="${CLINIC_NAME}" \
CLINIC_TIMEZONE="UTC" \
CLINIC_ADMIN_EMAIL="${CLINIC_ADMIN_EMAIL}" \
CLINIC_ADMIN_PASSWORD="${CLINIC_ADMIN_PASSWORD}" \
THERAPIST_EMAIL="${THERAPIST_EMAIL}" \
THERAPIST_NAME="${THERAPIST_NAME}" \
THERAPIST_PASSWORD="${THERAPIST_PASSWORD}" \
CLIENT_PASSWORD="${CLIENT_PASSWORD}" \
CLIENT_COUNT="1" \
ASSIGNMENTS_PER_CLIENT="1" \
START_DATE="${START_DATE}" \
END_DATE="${END_DATE}" \
INCLUDE_ESCALATION="false" \
INCLUDE_EXTERNAL_TOKEN="false" \
INCLUDE_AI_DRAFTS="false" \
npm --prefix backend run pilot:seed | tee "${SEED_LOG}"

SEED_JSON=$(sed -n 's/^PILOT_SEED_RESULT=//p' "${SEED_LOG}" | tail -n 1)
if [[ -z "${SEED_JSON}" ]]; then
  echo "Seed output missing PILOT_SEED_RESULT." >&2
  exit 1
fi

CLINIC_ID=$(echo "${SEED_JSON}" | node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(data.clinicId||"");')
CLIENT_ID=$(echo "${SEED_JSON}" | node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(0,"utf8")); const client=Array.isArray(data.clientIds)?data.clientIds[0]:""; process.stdout.write(client||"");')
PERIOD_START=$(echo "${SEED_JSON}" | node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(data.periodStart||"");')
PERIOD_END=$(echo "${SEED_JSON}" | node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(data.periodEnd||"");')

BASE_SLUG=$(node -e 'const name=process.argv[1]||""; const slug=name.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""); process.stdout.write(slug);' "${CLINIC_NAME}")
CLIENT_EMAIL="pilot-client-1@${BASE_SLUG}.local"

if [[ -z "${CLINIC_ID}" || -z "${CLIENT_ID}" ]]; then
  echo "Seed did not return clinicId/clientId." >&2
  exit 1
fi

echo "CLINIC_ID=${CLINIC_ID}"
echo "CLIENT_ID=${CLIENT_ID}"
echo "PERIOD=${PERIOD_START} → ${PERIOD_END}"

login() {
  local email="$1"
  local password="$2"
  local cookie="$3"
  local headers
  local body
  headers=$(mktemp)
  body=$(mktemp)
  curl -s -D "${headers}" -o "${body}" -X POST "${BASE_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\"}" \
    -c "${cookie}"
  local status
  status=$(head -n 1 "${headers}")
  if [[ "${status}" != *"200"* && "${status}" != *"201"* ]]; then
    echo "Login failed for ${email} (${status})" >&2
    exit 1
  fi
}

echo "== Step 2: login as clinic admin"
ADMIN_COOKIE=$(mktemp)
login "${CLINIC_ADMIN_EMAIL}" "${CLINIC_ADMIN_PASSWORD}" "${ADMIN_COOKIE}"

echo "== Step 3: login as therapist"
THERAPIST_COOKIE=$(mktemp)
login "${THERAPIST_EMAIL}" "${THERAPIST_PASSWORD}" "${THERAPIST_COOKIE}"

echo "== Step 4: login as client"
CLIENT_COOKIE=$(mktemp)
login "${CLIENT_EMAIL}" "${CLIENT_PASSWORD}" "${CLIENT_COOKIE}"

echo "== Step 5: ensure published library item"
LIBRARY_JSON=$(mktemp)
LIB_HEADERS=$(mktemp)
curl -s -D "${LIB_HEADERS}" -o "${LIBRARY_JSON}" -b "${ADMIN_COOKIE}" \
  "${BASE_URL}/library/items?status=published&clinicId=${CLINIC_ID}"
LIB_STATUS=$(head -n 1 "${LIB_HEADERS}")
if [[ "${LIB_STATUS}" != *"200"* ]]; then
  echo "Library list failed (${LIB_STATUS})." >&2
  exit 1
fi
LIBRARY_ITEM_ID=$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(0,"utf8")); const item=Array.isArray(data)?data[0]:null; process.stdout.write(item?.id||"");' < "${LIBRARY_JSON}")
if [[ -z "${LIBRARY_ITEM_ID}" ]]; then
  echo "No published library items found for clinic." >&2
  echo "Run: CLINIC_ID=${CLINIC_ID} npm --prefix backend run ingest:clinical-library" >&2
  exit 1
fi

echo "== Step 6: assign library item"
ASSIGN_JSON=$(mktemp)
ASSIGN_HEADERS=$(mktemp)
curl -s -D "${ASSIGN_HEADERS}" -o "${ASSIGN_JSON}" -b "${THERAPIST_COOKIE}" \
  -H "Content-Type: application/json" \
  -X POST "${BASE_URL}/assignments/from-library" \
  -d "{\"clientId\":\"${CLIENT_ID}\",\"libraryItemId\":\"${LIBRARY_ITEM_ID}\",\"dueDate\":\"${PERIOD_END}\",\"note\":\"Pilot assignment\"}"
ASSIGN_STATUS=$(head -n 1 "${ASSIGN_HEADERS}")
if [[ "${ASSIGN_STATUS}" != *"200"* && "${ASSIGN_STATUS}" != *"201"* ]]; then
  echo "Assignment creation failed (${ASSIGN_STATUS})." >&2
  exit 1
fi
ASSIGNMENT_ID=$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(data.id||"");' < "${ASSIGN_JSON}")
if [[ -z "${ASSIGNMENT_ID}" ]]; then
  echo "Assignment response missing id." >&2
  exit 1
fi

echo "== Step 7: submit client response"
RESP_JSON=$(mktemp)
RESP_HEADERS=$(mktemp)
curl -s -D "${RESP_HEADERS}" -o "${RESP_JSON}" -b "${CLIENT_COOKIE}" \
  -H "Content-Type: application/json" \
  -X POST "${BASE_URL}/responses/submit" \
  -d "{\"assignmentId\":\"${ASSIGNMENT_ID}\",\"text\":\"Pilot response\",\"mood\":6}"
RESP_STATUS=$(head -n 1 "${RESP_HEADERS}")
if [[ "${RESP_STATUS}" != *"200"* && "${RESP_STATUS}" != *"201"* ]]; then
  echo "Response submission failed (${RESP_STATUS})." >&2
  exit 1
fi
RESPONSE_ID=$(node -e 'const fs=require("fs"); const data=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(data.id||"");' < "${RESP_JSON}")
if [[ -z "${RESPONSE_ID}" ]]; then
  echo "Response submission missing id." >&2
  exit 1
fi

echo "== Step 8: mark reviewed"
REVIEW_HEADERS=$(mktemp)
curl -s -D "${REVIEW_HEADERS}" -o /dev/null -b "${THERAPIST_COOKIE}" \
  -H "Content-Type: application/json" \
  -X POST "${BASE_URL}/review-queue/mark-reviewed" \
  -d "{\"responseIds\":[\"${RESPONSE_ID}\"],\"therapistNote\":\"Pilot review\"}"
REVIEW_STATUS=$(head -n 1 "${REVIEW_HEADERS}")
if [[ "${REVIEW_STATUS}" != *"200"* && "${REVIEW_STATUS}" != *"201"* ]]; then
  echo "Mark reviewed failed (${REVIEW_STATUS})." >&2
  exit 1
fi

echo "== Step 9: generate AER JSON/PDF twice and verify determinism"
AER_JSON_1=$(mktemp)
AER_JSON_2=$(mktemp)
AER_PDF_1=$(mktemp)
AER_PDF_2=$(mktemp)

for i in 1 2; do
  OUT_JSON_VAR="AER_JSON_${i}"
  OUT_PDF_VAR="AER_PDF_${i}"
  OUT_JSON="${!OUT_JSON_VAR}"
  OUT_PDF="${!OUT_PDF_VAR}"

  JSON_HEADERS=$(mktemp)
  curl -s -D "${JSON_HEADERS}" -o "${OUT_JSON}" -b "${ADMIN_COOKIE}" \
    "${BASE_URL}/reports/aer/${CLINIC_ID}/${CLIENT_ID}?start=${PERIOD_START}&end=${PERIOD_END}"
  JSON_STATUS=$(head -n 1 "${JSON_HEADERS}")
  if [[ "${JSON_STATUS}" != *"200"* ]]; then
    echo "AER JSON generation failed (${JSON_STATUS})." >&2
    exit 1
  fi

  PDF_HEADERS=$(mktemp)
  curl -s -D "${PDF_HEADERS}" -o "${OUT_PDF}" -b "${ADMIN_COOKIE}" \
    "${BASE_URL}/reports/aer/${CLINIC_ID}/${CLIENT_ID}.pdf?start=${PERIOD_START}&end=${PERIOD_END}"
  PDF_STATUS=$(head -n 1 "${PDF_HEADERS}")
  if [[ "${PDF_STATUS}" != *"200"* ]]; then
    echo "AER PDF generation failed (${PDF_STATUS})." >&2
    exit 1
  fi
done

JSON_HASH_1=$(shasum -a 256 "${AER_JSON_1}" | awk '{print $1}')
JSON_HASH_2=$(shasum -a 256 "${AER_JSON_2}" | awk '{print $1}')
PDF_HASH_1=$(shasum -a 256 "${AER_PDF_1}" | awk '{print $1}')
PDF_HASH_2=$(shasum -a 256 "${AER_PDF_2}" | awk '{print $1}')

if [[ "${JSON_HASH_1}" != "${JSON_HASH_2}" ]]; then
  echo "AER JSON determinism check failed." >&2
  exit 1
fi
if [[ "${PDF_HASH_1}" != "${PDF_HASH_2}" ]]; then
  echo "AER PDF determinism check failed." >&2
  exit 1
fi

echo "== Step 10: generate submission bundle v2"
BUNDLE_ZIP=$(mktemp --suffix .zip)
BUNDLE_HEADERS=$(mktemp)
BODY="{\"clinicId\":\"${CLINIC_ID}\",\"clientId\":\"${CLIENT_ID}\",\"start\":\"${PERIOD_START}\",\"end\":\"${PERIOD_END}\",\"profile\":\"${PROFILE}\""
if [[ "${INCLUDE_EXTERNAL_LINKS}" == "true" ]]; then
  BODY="${BODY},\"includeExternalLinks\":true"
fi
BODY="${BODY}}"

curl -s -D "${BUNDLE_HEADERS}" -o "${BUNDLE_ZIP}" -b "${ADMIN_COOKIE}" \
  -H "Content-Type: application/json" \
  -X POST "${BASE_URL}/reports/submission-bundle" \
  -d "${BODY}"
BUNDLE_STATUS=$(head -n 1 "${BUNDLE_HEADERS}")
if [[ "${BUNDLE_STATUS}" != *"200"* && "${BUNDLE_STATUS}" != *"201"* ]]; then
  echo "Submission bundle failed (${BUNDLE_STATUS})." >&2
  exit 1
fi

echo "== Step 11: public verification"
PUBLIC_VERIFY_OUT=$(mktemp)
set +e
VERIFY_OUTPUT=$(bash "${REPO_ROOT}/scripts/verify_aer_bundle_public.sh" "${BUNDLE_ZIP}" 2>&1)
VERIFY_STATUS=$?
set -e
echo "${VERIFY_OUTPUT}" > "${PUBLIC_VERIFY_OUT}"
if [[ "${VERIFY_STATUS}" -ne 0 ]]; then
  echo "Public verification failed." >&2
  exit 1
fi

echo "== Step 12: build pilot packet"
DATE_TAG="$(date +%F)"
PACKET_DIR="${OUT_DIR}/${DATE_TAG}_${CLINIC_ID}"
mkdir -p "${PACKET_DIR}"

cp "${AER_JSON_1}" "${PACKET_DIR}/AER.json"
cp "${AER_PDF_1}" "${PACKET_DIR}/AER.pdf"
cp "${BUNDLE_ZIP}" "${PACKET_DIR}/submission_bundle_v2.zip"
cp "${PUBLIC_VERIFY_OUT}" "${PACKET_DIR}/verification_public.txt"
cp "${REPO_ROOT}/docs/pilot/PILOT_PACKET_CHECKLIST.md" "${PACKET_DIR}/CHECKLIST.md"

cat <<EOF > "${PACKET_DIR}/verification_internal.txt"
JSON_SHA256=${JSON_HASH_1}
PDF_SHA256=${PDF_HASH_1}
DETERMINISM=PASS
EOF

EMAIL_OUT="${PACKET_DIR}/UR_EMAIL_TEMPLATE.txt"
bash "${REPO_ROOT}/scripts/generate_ur_email_template.sh" \
  --profile "${PROFILE}" \
  --clinicName "${CLINIC_NAME}" \
  --clientDisplayId "${CLIENT_ID}" \
  --periodStart "${PERIOD_START}" \
  --periodEnd "${PERIOD_END}" \
  --bundleFilename "submission_bundle_v2.zip" \
  --out "${EMAIL_OUT}"

README_TEMPLATE="${REPO_ROOT}/docs/pilot/PILOT_PACKET_README_TEMPLATE.md"
README_OUT="${PACKET_DIR}/README.md"
sed \
  -e "s/{{CLINIC_ID}}/${CLINIC_ID}/g" \
  -e "s/{{CLIENT_ID}}/${CLIENT_ID}/g" \
  -e "s/{{PERIOD_START}}/${PERIOD_START}/g" \
  -e "s/{{PERIOD_END}}/${PERIOD_END}/g" \
  -e "s/{{PROFILE}}/${PROFILE}/g" \
  -e "s/{{BUNDLE_FILENAME}}/submission_bundle_v2.zip/g" \
  "${README_TEMPLATE}" > "${README_OUT}"

echo "== DONE"
echo "Packet: ${PACKET_DIR}"
echo "AER JSON SHA256: ${JSON_HASH_1}"
echo "AER PDF SHA256: ${PDF_HASH_1}"
echo "Public verification: PASS"
echo "Re-run:"
echo "bash scripts/pilot_simulation_v1.sh --out ${OUT_DIR} --profile ${PROFILE} --period-days ${PERIOD_DAYS} --seed-suffix ${SEED_SUFFIX}"
