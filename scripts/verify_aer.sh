#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000/api/v1}"
SCHEMA_PATH="${SCHEMA_PATH:-docs/aer/AER_STANDARD_V1.schema.json}"

AER_TOKEN="${AER_TOKEN:-}"
AER_TOKEN_JSON="${AER_TOKEN_JSON:-}"
AER_TOKEN_PDF="${AER_TOKEN_PDF:-}"

CLINIC_ID="${CLINIC_ID:-}"
CLIENT_ID="${CLIENT_ID:-}"
START="${START:-}"
END="${END:-}"
PROGRAM="${PROGRAM:-}"

AUTH_COOKIE="${AUTH_COOKIE:-}"
AUTH_BEARER="${AUTH_BEARER:-}"

fail() {
  echo "FAIL: $1" >&2
  echo "FAIL"
  exit 1
}

if [[ -n "${AER_TOKEN}" ]]; then
  AER_TOKEN_JSON="${AER_TOKEN}"
  AER_TOKEN_PDF="${AER_TOKEN}"
fi

if [[ -n "${AER_TOKEN_JSON}" && -n "${AER_TOKEN_PDF}" ]]; then
  JSON_URL="${BASE_URL}/external/aer.json?token=${AER_TOKEN_JSON}"
  PDF_URL="${BASE_URL}/external/aer.pdf?token=${AER_TOKEN_PDF}"
else
  if [[ -z "${CLINIC_ID}" || -z "${CLIENT_ID}" || -z "${START}" || -z "${END}" ]]; then
    fail "Missing tokens and missing clinic/client/start/end for internal verification."
  fi
  if [[ -z "${AUTH_COOKIE}" && -z "${AUTH_BEARER}" ]]; then
    fail "Missing AUTH_COOKIE or AUTH_BEARER for internal verification."
  fi
  qs="start=${START}&end=${END}"
  if [[ -n "${PROGRAM}" ]]; then qs="${qs}&program=${PROGRAM}"; fi
  JSON_URL="${BASE_URL}/reports/aer/${CLINIC_ID}/${CLIENT_ID}?${qs}"
  PDF_URL="${BASE_URL}/reports/aer/${CLINIC_ID}/${CLIENT_ID}.pdf?${qs}"
fi

curl_headers=()
if [[ -n "${AUTH_COOKIE}" ]]; then
  curl_headers+=("-H" "Cookie: ${AUTH_COOKIE}")
fi
if [[ -n "${AUTH_BEARER}" ]]; then
  if [[ "${AUTH_BEARER}" == Bearer* ]]; then
    curl_headers+=("-H" "Authorization: ${AUTH_BEARER}")
  else
    curl_headers+=("-H" "Authorization: Bearer ${AUTH_BEARER}")
  fi
fi

fetch_file() {
  local url="$1"
  local outfile="$2"
  local status
  if [[ ${#curl_headers[@]} -gt 0 ]]; then
    status=$(curl -sS -o "${outfile}" -w "%{http_code}" "${curl_headers[@]}" "${url}") || return 2
  else
    status=$(curl -sS -o "${outfile}" -w "%{http_code}" "${url}") || return 2
  fi
  if [[ ! "${status}" =~ ^2 ]]; then
    fail "HTTP ${status} on ${url}. $(cat "${outfile}")"
  fi
}

json1=$(mktemp)
json2=$(mktemp)
pdf1=$(mktemp)
pdf2=$(mktemp)

fetch_file "${JSON_URL}" "${json1}"
fetch_file "${JSON_URL}" "${json2}"
fetch_file "${PDF_URL}" "${pdf1}"
fetch_file "${PDF_URL}" "${pdf2}"

json_hash1=$(shasum -a 256 "${json1}" | awk '{print $1}')
json_hash2=$(shasum -a 256 "${json2}" | awk '{print $1}')
pdf_hash1=$(shasum -a 256 "${pdf1}" | awk '{print $1}')
pdf_hash2=$(shasum -a 256 "${pdf2}" | awk '{print $1}')

if [[ "${json_hash1}" != "${json_hash2}" ]]; then
  fail "JSON hash mismatch: ${json_hash1} vs ${json_hash2}"
fi
if [[ "${pdf_hash1}" != "${pdf_hash2}" ]]; then
  fail "PDF hash mismatch: ${pdf_hash1} vs ${pdf_hash2}"
fi

node -e "const fs=require('fs'); const crypto=require('crypto'); const addFormats=require('./backend/node_modules/ajv-formats'); const Ajv=(()=>{ try { return require('./backend/node_modules/ajv/dist/2020'); } catch (err) { return require('./backend/node_modules/ajv'); } })(); const schemaRaw=fs.readFileSync('${SCHEMA_PATH}','utf8'); const schema=JSON.parse(schemaRaw); const data=JSON.parse(fs.readFileSync('${json1}','utf8')); const ajv=new Ajv({allErrors:true,strict:true}); addFormats(ajv); const validate=ajv.compile(schema); if(!validate(data)){ console.error(validate.errors); process.exit(1);} const verification=data?.meta?.verification; if(!verification){ console.error('Missing meta.verification'); process.exit(1);} const required=['standard','standard_version','schema_version','schema_sha256']; for(const key of required){ if(!verification[key]){ console.error('Missing meta.verification.' + key); process.exit(1);} } const schemaSha=crypto.createHash('sha256').update(schemaRaw).digest('hex'); if(verification.schema_sha256!==schemaSha){ console.error('schema_sha256 mismatch: ' + verification.schema_sha256 + ' vs ' + schemaSha); process.exit(1);} console.log('META_VERIFICATION='+JSON.stringify(verification));"

rm -f "${json1}" "${json2}" "${pdf1}" "${pdf2}"

echo "JSON_SHA256=${json_hash1}"
echo "PDF_SHA256=${pdf_hash1}"
echo "PASS"
