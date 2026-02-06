export const DRAFT_RESPONSE_SCHEMA = {
  type: "object",
  required: ["text", "evidence_refs"],
  properties: {
    text: { type: "string" },
    evidence_refs: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;
