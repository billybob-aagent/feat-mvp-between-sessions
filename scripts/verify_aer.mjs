import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const requireFromBackend = createRequire(path.join(process.cwd(), "backend", "package.json"));
const Ajv = (() => {
  try {
    return requireFromBackend("ajv/dist/2020");
  } catch (err) {
    return requireFromBackend("ajv");
  }
})();
const addFormats = requireFromBackend("ajv-formats");

const args = process.argv.slice(2);
const argMap = new Map();
for (let i = 0; i < args.length; i += 1) {
  const raw = args[i];
  if (!raw.startsWith("--")) continue;
  const key = raw.replace(/^--/, "");
  const next = args[i + 1];
  if (next && !next.startsWith("--")) {
    argMap.set(key, next);
    i += 1;
  } else {
    argMap.set(key, "true");
  }
}

const envOrArg = (key, fallback) => {
  if (argMap.has(key)) return argMap.get(key);
  const envKey = key.toUpperCase().replace(/-/g, "_");
  return process.env[envKey] ?? fallback;
};

const verbose = ["1", "true", "yes"].includes(String(process.env.VERBOSE || "").toLowerCase());

const baseUrlInput = envOrArg("base-url", "http://localhost:4000/api/v1");
const baseUrl = baseUrlInput.replace(/\/$/, "");
const schemaPath = envOrArg("schema", path.join("docs", "aer", "AER_STANDARD_V1.schema.json"));
const token = envOrArg("token", process.env.AER_TOKEN || "");
const tokenJson = envOrArg("token-json", process.env.AER_TOKEN_JSON || "");
const tokenPdf = envOrArg("token-pdf", process.env.AER_TOKEN_PDF || "");
const clinicId = envOrArg("clinic-id", "");
const clientId = envOrArg("client-id", "");
const start = envOrArg("start", "");
const end = envOrArg("end", "");
const program = envOrArg("program", "");

const authCookie = process.env.AUTH_COOKIE || "";
const authBearer = process.env.AUTH_BEARER || "";

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  console.log("FAIL");
  process.exit(1);
};

const sha256 = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");

const buildUrl = (suffix) => {
  if (!suffix.startsWith("/")) return `${baseUrl}/${suffix}`;
  return `${baseUrl}${suffix}`;
};

const buildInternalUrl = (ext) => {
  if (!clinicId || !clientId || !start || !end) {
    fail("Missing clinic-id/client-id/start/end for internal verification.");
  }
  const params = new URLSearchParams({ start, end });
  if (program) params.set("program", program);
  return buildUrl(`/reports/aer/${clinicId}/${clientId}${ext}?${params.toString()}`);
};

const buildExternalUrl = (ext, tokenValue) => {
  if (!tokenValue) fail("Missing token for external verification.");
  const params = new URLSearchParams({ token: tokenValue });
  return buildUrl(`/external/aer${ext}?${params.toString()}`);
};

const resolveTokens = () => {
  if (token) return { json: token, pdf: token };
  if (tokenJson && tokenPdf) return { json: tokenJson, pdf: tokenPdf };
  return null;
};

const buildHeaders = () => {
  const headers = [];
  if (authCookie) headers.push(`Cookie: ${authCookie}`);
  if (authBearer) {
    const value = authBearer.startsWith("Bearer ") ? authBearer : `Bearer ${authBearer}`;
    headers.push(`Authorization: ${value}`);
  }
  return headers;
};

const curlFetch = (url) => {
  const headers = buildHeaders();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "verify-aer-"));
  const outPath = path.join(tmpDir, "payload");
  const args = ["-sS", "-o", outPath, "-w", "%{http_code}"];
  for (const header of headers) {
    args.push("-H", header);
  }
  args.push(url);
  let status = "";
  try {
    status = String(execFileSync("curl", args, { encoding: "utf8" })).trim();
  } catch (err) {
    fail(`curl failed for ${url}. ${err instanceof Error ? err.message : String(err)}`);
  }
  const body = fs.readFileSync(outPath);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (!status.startsWith("2")) {
    fail(`HTTP ${status} on ${url}. ${body.toString("utf8")}`.trim());
  }
  return body;
};

const validateSchema = (payload) => {
  const schemaRaw = fs.readFileSync(schemaPath, "utf8");
  const schema = JSON.parse(schemaRaw);
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const ok = validate(payload);
  if (!ok) {
    const details = (validate.errors || [])
      .map((err) => `${err.instancePath || "<root>"} ${err.message}`)
      .join("; ");
    fail(`Schema validation failed. ${details}`);
  }
};

const run = async () => {
  const externalTokens = resolveTokens();
  const jsonUrl = externalTokens
    ? buildExternalUrl(".json", externalTokens.json)
    : buildInternalUrl("");
  const pdfUrl = externalTokens
    ? buildExternalUrl(".pdf", externalTokens.pdf)
    : buildInternalUrl(".pdf");

  if (verbose) {
    console.log(`JSON_URL=${jsonUrl}`);
    console.log(`PDF_URL=${pdfUrl}`);
  }

  if (!externalTokens && !authCookie && !authBearer) {
    fail("Missing AUTH_COOKIE or AUTH_BEARER for internal verification.");
  }

  const json1 = curlFetch(jsonUrl).toString("utf8");
  const json2 = curlFetch(jsonUrl).toString("utf8");
  const pdf1 = curlFetch(pdfUrl);
  const pdf2 = curlFetch(pdfUrl);

  const jsonHash1 = sha256(Buffer.from(json1, "utf8"));
  const jsonHash2 = sha256(Buffer.from(json2, "utf8"));
  const pdfHash1 = sha256(pdf1);
  const pdfHash2 = sha256(pdf2);

  const parsed = JSON.parse(json1);
  validateSchema(parsed);

  if (jsonHash1 !== jsonHash2) {
    fail(`JSON hash mismatch: ${jsonHash1} vs ${jsonHash2}`);
  }

  if (pdfHash1 !== pdfHash2) {
    fail(`PDF hash mismatch: ${pdfHash1} vs ${pdfHash2}`);
  }

  console.log(`JSON_SHA256=${jsonHash1}`);
  console.log(`PDF_SHA256=${pdfHash1}`);
  console.log("PASS");
};

run().catch((err) => {
  if (verbose) console.error(err);
  fail(err instanceof Error ? err.message : String(err));
});
