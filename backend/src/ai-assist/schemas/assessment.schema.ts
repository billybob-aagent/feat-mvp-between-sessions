export const ASSESSMENT_RESPONSE_SCHEMA = {
  type: "object",
  required: ["draft_sections", "gaps_questions", "evidence_mapping"],
  properties: {
    draft_sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          content: { type: "string" },
        },
        required: ["title", "content"],
      },
    },
    gaps_questions: {
      type: "array",
      items: { type: "string" },
    },
    evidence_mapping: {
      type: "array",
      items: {
        type: "object",
        properties: {
          input_key: { type: "string" },
          used_in_section: { type: "string" },
        },
        required: ["input_key", "used_in_section"],
      },
    },
    sources_used: { type: "array", items: { type: "string" } },
  },
} as const;
