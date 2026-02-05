const SYSTEM_INSTRUCTION =
  "You are an assistant generating drafts for clinician review. Do not diagnose, treat, or recommend care. Output JSON only.";

type AdherencePromptParams = {
  payload: Record<string, any>;
  sources: Array<{
    id: string;
    itemId: string;
    title: string;
    headingPath: string;
    text: string;
  }>;
  schema: Record<string, any>;
};

const buildBlock = (label: string, content: string) =>
  [`<${label}>`, content, `</${label}>`].join("\n");

export const buildAdherencePrompt = (params: AdherencePromptParams) => {
  const payloadJson = JSON.stringify(params.payload ?? {});
  const schemaJson = JSON.stringify(params.schema ?? {});
  const sourcesJson = JSON.stringify(params.sources ?? []);

  return [
    SYSTEM_INSTRUCTION,
    "ASSISTANT: LLM-1_ADHERENCE_EVIDENCE",
    "PURPOSE: ADHERENCE_REVIEW",
    buildBlock("SCHEMA", schemaJson),
    buildBlock("SANITIZED_PAYLOAD", payloadJson),
    buildBlock("RETRIEVED_SOURCES", sourcesJson),
  ].join("\n");
};
