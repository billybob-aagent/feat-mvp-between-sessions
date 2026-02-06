const SYSTEM_INSTRUCTION =
  "You are an assistant generating drafts for clinician review. Do not diagnose, treat, recommend care, or assess medical necessity. Output JSON only.";

type DraftPromptParams = {
  assistant: string;
  purpose: string;
  payload: Record<string, any>;
  schema: Record<string, any>;
  instructions?: string[];
};

const buildBlock = (label: string, content: string) =>
  [`<${label}>`, content, `</${label}>`].join("\n");

export const buildDraftPrompt = (params: DraftPromptParams) => {
  const payloadJson = JSON.stringify(params.payload ?? {});
  const schemaJson = JSON.stringify(params.schema ?? {});
  const instructionLines = params.instructions ?? [];

  return [
    SYSTEM_INSTRUCTION,
    `ASSISTANT: ${params.assistant}`,
    `PURPOSE: ${params.purpose}`,
    ...instructionLines,
    buildBlock("SCHEMA", schemaJson),
    buildBlock("SANITIZED_PAYLOAD", payloadJson),
  ].join("\n");
};
