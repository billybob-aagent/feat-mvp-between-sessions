"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/signature-pad";

export default function ClientSignaturePage() {
  const params = useParams();
  const requestId = String(params.requestId);
  const [signerName, setSignerName] = useState("");
  const [typedSignature, setTypedSignature] = useState("");
  const [drawnSignature, setDrawnSignature] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    "http://localhost:4000/api/v1";
  const pdfUrl = `${apiBase}/library/forms/${requestId}/pdf`;

  async function submitSignature() {
    if (!signerName.trim()) {
      setStatus("Enter your name to sign.");
      return;
    }
    if (!typedSignature.trim() && !drawnSignature) {
      setStatus("Provide a typed or drawn signature.");
      return;
    }
    setSubmitting(true);
    setStatus(null);
    try {
      await apiFetch(`/library/signatures/${requestId}/sign`, {
        method: "POST",
        json: {
          signerName: signerName.trim(),
          typedSignature: typedSignature.trim() || undefined,
          drawnSignatureDataUrl: drawnSignature || undefined,
        },
      });
      setStatus("Signature submitted.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-h1 mb-4">Sign Form</h1>
      <p className="text-sm text-app-muted mb-6">
        Review the form below, then provide your signature. A clinician will review
        before any interpretation.
      </p>

      <Card className="mb-6">
        <CardContent>
          <iframe
            title="Form preview"
            src={pdfUrl}
            className="w-full h-[520px] rounded-md border"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-label text-app-muted mb-1">Full name</label>
            <Input value={signerName} onChange={(event) => setSignerName(event.target.value)} />
          </div>
          <div>
            <label className="block text-label text-app-muted mb-1">Typed signature</label>
            <Input
              value={typedSignature}
              onChange={(event) => setTypedSignature(event.target.value)}
              placeholder="Type your name"
            />
          </div>
          <div>
            <label className="block text-label text-app-muted mb-1">Drawn signature</label>
            <SignaturePad onChange={setDrawnSignature} />
          </div>
          <Button type="button" variant="primary" disabled={submitting} onClick={submitSignature}>
            {submitting ? "Submitting..." : "Sign now"}
          </Button>
          {status && (
            <div className="text-sm text-app-muted">
              <p>{status}</p>
              <a href={pdfUrl} className="text-app-accent" target="_blank" rel="noreferrer">
                Download signed PDF
              </a>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
