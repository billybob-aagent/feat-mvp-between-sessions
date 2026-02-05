"use client";

import { Input } from "@/components/ui/input";

function parseCsv(value: string) {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function csvFrom(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value.map(String).join(", ");
}

function strFrom(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function MetadataEditor({
  metadata,
  onChange,
}: {
  metadata: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <label className="text-label text-app-muted">Domains (comma-separated)</label>
        <Input
          value={csvFrom(metadata.primaryClinicalDomains)}
          onChange={(e) => {
            onChange({ ...metadata, primaryClinicalDomains: parseCsv(e.target.value) });
          }}
          placeholder="anxiety, depression, relapse prevention"
        />
      </div>
      <div>
        <label className="text-label text-app-muted">Modalities (comma-separated)</label>
        <Input
          value={csvFrom(metadata.applicableModalities)}
          onChange={(e) => {
            onChange({ ...metadata, applicableModalities: parseCsv(e.target.value) });
          }}
          placeholder="CBT, DBT, MI"
        />
      </div>
      <div>
        <label className="text-label text-app-muted">Population (comma-separated)</label>
        <Input
          value={csvFrom(metadata.targetPopulation)}
          onChange={(e) => {
            onChange({ ...metadata, targetPopulation: parseCsv(e.target.value) });
          }}
          placeholder="adults, adolescents"
        />
      </div>
      <div>
        <label className="text-label text-app-muted">Complexity</label>
        <Input
          value={strFrom(metadata.clinicalComplexityLevel)}
          onChange={(e) => onChange({ ...metadata, clinicalComplexityLevel: e.target.value })}
          placeholder="low | medium | high"
        />
      </div>
      <div>
        <label className="text-label text-app-muted">Session use</label>
        <Input
          value={strFrom(metadata.sessionUse)}
          onChange={(e) => onChange({ ...metadata, sessionUse: e.target.value })}
          placeholder="between-session | in-session | homework"
        />
      </div>
      <div>
        <label className="text-label text-app-muted">Setting (optional)</label>
        <Input
          value={csvFrom(metadata.clinicalSetting)}
          onChange={(e) => onChange({ ...metadata, clinicalSetting: parseCsv(e.target.value) })}
          placeholder="IOP, PHP, OP"
        />
      </div>
    </div>
  );
}

