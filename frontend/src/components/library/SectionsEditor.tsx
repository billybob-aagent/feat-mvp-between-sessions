"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";

type Section = Record<string, unknown>;

function strFrom(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function setField(sections: Section[], idx: number, patch: Partial<Section>) {
  return sections.map((s, i) => (i === idx ? { ...s, ...patch } : s));
}

export function SectionsEditor({
  sections,
  onChange,
}: {
  sections: Section[];
  onChange: (next: Section[]) => void;
}) {
  return (
    <div className="space-y-3">
      <Alert variant="info">
        Sections must be explicitly labeled for <strong>Clinician</strong> or <strong>Client</strong> audience. Client view only renders Client sections.
      </Alert>

      {sections.length === 0 && (
        <div className="text-sm text-app-muted">No sections yet.</div>
      )}

      {sections.map((section, idx) => (
        <div key={idx} className="rounded-lg border border-app-border bg-app-surface p-4 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="text-label text-app-muted">Title</label>
              <Input
                value={strFrom(section.title)}
                onChange={(e) => onChange(setField(sections, idx, { title: e.target.value }))}
                placeholder="Section title"
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="text-label text-app-muted">Heading path (optional)</label>
              <Input
                value={strFrom(section.headingPath)}
                onChange={(e) => onChange(setField(sections, idx, { headingPath: e.target.value }))}
                placeholder="Collection > Item > Section"
              />
            </div>
            <div className="min-w-[160px]">
              <label className="text-label text-app-muted">Audience</label>
              <Select
                value={strFrom(section.audience) || "Clinician"}
                onChange={(e) => onChange(setField(sections, idx, { audience: e.target.value }))}
              >
                <option value="Clinician">Clinician</option>
                <option value="Client">Client</option>
              </Select>
            </div>
            <div className="min-w-[180px]">
              <label className="text-label text-app-muted">Section type (optional)</label>
              <Input
                value={strFrom(section.sectionType)}
                onChange={(e) => onChange(setField(sections, idx, { sectionType: e.target.value }))}
                placeholder="Overview, Steps, Scoring..."
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onChange(sections.filter((_, i) => i !== idx))}
              >
                Remove
              </Button>
            </div>
          </div>

          <div>
            <label className="text-label text-app-muted">Text</label>
            <Textarea
              value={strFrom(section.text)}
              onChange={(e) => onChange(setField(sections, idx, { text: e.target.value }))}
              rows={5}
            />
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            onChange([
              ...sections,
              {
                title: "New section",
                headingPath: "",
                audience: "Clinician",
                sectionType: "Overview",
                text: "",
              },
            ])
          }
        >
          Add section
        </Button>
      </div>
    </div>
  );
}

