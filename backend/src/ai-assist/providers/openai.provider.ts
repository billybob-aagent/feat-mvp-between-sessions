import { ServiceUnavailableException } from "@nestjs/common";
import { LlmGenerateInput, LlmProvider } from "./llm-provider.interface";

export class OpenAiProvider implements LlmProvider {
  constructor(private apiKey?: string) {}

  async generateStructured<T>(_input: LlmGenerateInput): Promise<T> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException("AI provider not configured");
    }
    throw new ServiceUnavailableException("OpenAI provider not configured");
  }
}
