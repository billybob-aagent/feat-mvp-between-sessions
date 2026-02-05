export const ADHERENCE_RESPONSE_SCHEMA = {
  type: "object",
  required: [
    "criteria_match",
    "confidence",
    "evidence_snippets",
    "missing_elements",
    "suggested_clinician_feedback_draft",
  ],
  properties: {
    criteria_match: {
      type: "string",
      enum: ["MET", "PARTIAL", "NOT_MET", "UNCLEAR"],
    },
    confidence: {
      type: "string",
      enum: ["LOW", "MEDIUM", "HIGH"],
    },
    evidence_snippets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          reason: { type: "string" },
          source_ids: { type: "array", items: { type: "string" } },
        },
        required: ["text", "reason", "source_ids"],
      },
    },
    missing_elements: {
      type: "array",
      items: { type: "string" },
    },
    suggested_clinician_feedback_draft: { type: "string" },
    sources_used: { type: "array", items: { type: "string" } },
  },
} as const;
