export type LlmGenerateInput = {
  purpose: string;
  prompt: string;
  schema: Record<string, any>;
  temperature?: number;
  maxTokens?: number;
};

export interface LlmProvider {
  generateStructured<T>(input: LlmGenerateInput): Promise<T>;
}
