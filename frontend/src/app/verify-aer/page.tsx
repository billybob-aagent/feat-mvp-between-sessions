"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const decoder = new TextDecoder("utf-8");

type VerificationResult = {
  status: "pass" | "fail";
  reason?: string;
  jsonHash: string;
  pdfHash: string;
  expectedJson: string;
  expectedPdf: string;
  reportId?: string;
  generatedAt?: string;
  metaVerification?: string;
};

function toHex(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(data: Uint8Array) {
  const copy = new Uint8Array(data);
  const hash = await crypto.subtle.digest("SHA-256", copy.buffer);
  return toHex(hash);
}

function parseVerification(text: string) {
  const lines = text.split(/\r?\n/);
  const find = (prefix: string) => lines.find((line) => line.startsWith(prefix));
  return {
    reportId: find("REPORT_ID=")?.slice("REPORT_ID=".length) ?? "",
    generatedAt: find("GENERATED_AT=")?.slice("GENERATED_AT=".length) ?? "",
    metaVerification: find("META_VERIFICATION=")?.slice("META_VERIFICATION=".length) ?? "",
    expectedJson: find("JSON_SHA256=")?.slice("JSON_SHA256=".length) ?? "",
    expectedPdf: find("PDF_SHA256=")?.slice("PDF_SHA256=".length) ?? "",
  };
}

function readUint32(view: DataView, offset: number) {
  return view.getUint32(offset, true);
}

function readUint16(view: DataView, offset: number) {
  return view.getUint16(offset, true);
}

function findEndOfCentralDirectory(bytes: Uint8Array) {
  const min = Math.max(0, bytes.length - 65558);
  for (let i = bytes.length - 22; i >= min; i -= 1) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      return i;
    }
  }
  return -1;
}

function extractZipEntries(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const eocdOffset = findEndOfCentralDirectory(data);
  if (eocdOffset < 0) {
    throw new Error("ZIP end-of-central-directory not found.");
  }

  const centralDirSize = readUint32(view, eocdOffset + 12);
  const centralDirOffset = readUint32(view, eocdOffset + 16);
  const entries: Record<string, Uint8Array> = {};
  let offset = centralDirOffset;
  const end = centralDirOffset + centralDirSize;

  while (offset < end) {
    const signature = readUint32(view, offset);
    if (signature !== 0x02014b50) break;

    const compression = readUint16(view, offset + 10);
    const compressedSize = readUint32(view, offset + 20);
    const fileNameLength = readUint16(view, offset + 28);
    const extraLength = readUint16(view, offset + 30);
    const commentLength = readUint16(view, offset + 32);
    const localHeaderOffset = readUint32(view, offset + 42);

    const nameStart = offset + 46;
    const nameBytes = data.slice(nameStart, nameStart + fileNameLength);
    const name = decoder.decode(nameBytes);

    if (compression !== 0) {
      throw new Error(`Unsupported ZIP compression for ${name}.`);
    }

    const localSig = readUint32(view, localHeaderOffset);
    if (localSig !== 0x04034b50) {
      throw new Error(`Invalid local header for ${name}.`);
    }

    const localNameLength = readUint16(view, localHeaderOffset + 26);
    const localExtraLength = readUint16(view, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const fileData = data.slice(dataStart, dataStart + compressedSize);

    entries[name] = fileData;

    offset = nameStart + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

export default function VerifyAerPage() {
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [verificationFile, setVerificationFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);

  async function verifyFromBuffers(
    jsonData: Uint8Array,
    pdfData: Uint8Array,
    verificationText: string,
  ) {
    const parsed = parseVerification(verificationText);
    if (!parsed.expectedJson || !parsed.expectedPdf) {
      throw new Error("verification.txt is missing JSON_SHA256 or PDF_SHA256.");
    }

    const jsonHash = await sha256Hex(jsonData);
    const pdfHash = await sha256Hex(pdfData);

    const pass = jsonHash === parsed.expectedJson && pdfHash === parsed.expectedPdf;
    return {
      status: pass ? "pass" : "fail",
      reason: pass ? undefined : "Hashes do not match verification.txt.",
      jsonHash,
      pdfHash,
      expectedJson: parsed.expectedJson,
      expectedPdf: parsed.expectedPdf,
      reportId: parsed.reportId,
      generatedAt: parsed.generatedAt,
      metaVerification: parsed.metaVerification,
    } as VerificationResult;
  }

  async function handleVerify() {
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      if (zipFile) {
        const data = new Uint8Array(await zipFile.arrayBuffer());
        const entries = extractZipEntries(data);
        const jsonData = entries["AER.json"];
        const pdfData = entries["AER.pdf"];
        const verificationData = entries["verification.txt"];
        if (!jsonData || !pdfData || !verificationData) {
          throw new Error("ZIP is missing AER.json, AER.pdf, or verification.txt.");
        }
        const verificationText = decoder.decode(verificationData);
        const res = await verifyFromBuffers(jsonData, pdfData, verificationText);
        setResult(res);
        return;
      }

      if (!jsonFile || !pdfFile || !verificationFile) {
        throw new Error("Upload AER.json, AER.pdf, and verification.txt.");
      }

      const [jsonData, pdfData, verificationText] = await Promise.all([
        jsonFile.arrayBuffer().then((buf) => new Uint8Array(buf)),
        pdfFile.arrayBuffer().then((buf) => new Uint8Array(buf)),
        verificationFile.text(),
      ]);

      const res = await verifyFromBuffers(jsonData, pdfData, verificationText);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function copyResults() {
    if (!result) return;
    const payload = [
      `STATUS=${result.status.toUpperCase()}`,
      `JSON_SHA256_EXPECTED=${result.expectedJson}`,
      `JSON_SHA256_COMPUTED=${result.jsonHash}`,
      `PDF_SHA256_EXPECTED=${result.expectedPdf}`,
      `PDF_SHA256_COMPUTED=${result.pdfHash}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      // ignore
    }
  }

  return (
    <main className="min-h-screen bg-app-bg text-app-text">
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-8">
        <header className="space-y-2">
          <h1 className="text-h1">Verify AER Bundle</h1>
          <p className="text-body text-app-muted">
            Upload an AER bundle or the individual files to verify integrity. Files are processed locally in your browser.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Upload Bundle (.zip)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              accept=".zip"
              onChange={(event) => setZipFile(event.target.files?.[0] ?? null)}
            />
            <div className="text-xs text-app-muted">If you upload a ZIP, the individual file inputs are ignored.</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Or Upload Individual Files</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <Input type="file" accept="application/json" onChange={(e) => setJsonFile(e.target.files?.[0] ?? null)} />
            <Input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} />
            <Input type="file" accept="text/plain" onChange={(e) => setVerificationFile(e.target.files?.[0] ?? null)} />
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={handleVerify} disabled={loading}>
            {loading ? "Verifying..." : "Verify"}
          </Button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>
                Result:{" "}
                <span
                  className={
                    result.status === "pass" ? "text-green-600" : "text-red-600"
                  }
                >
                  {result.status === "pass" ? "PASS" : "FAIL"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.reason && <div className="text-sm text-red-600">{result.reason}</div>}
              <div className="grid gap-2 text-sm">
                <div className="font-medium">Computed vs Expected</div>
                <div>JSON expected: {result.expectedJson}</div>
                <div>JSON computed: {result.jsonHash}</div>
                <div>PDF expected: {result.expectedPdf}</div>
                <div>PDF computed: {result.pdfHash}</div>
              </div>

              {(result.reportId || result.generatedAt || result.metaVerification) && (
                <div className="grid gap-2 text-sm">
                  <div className="font-medium">Verification Metadata</div>
                  {result.reportId && <div>Report ID: {result.reportId}</div>}
                  {result.generatedAt && <div>Generated At: {result.generatedAt}</div>}
                  {result.metaVerification && <div>Meta Verification: {result.metaVerification}</div>}
                </div>
              )}

              <Button variant="secondary" onClick={copyResults}>
                Copy Results
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
