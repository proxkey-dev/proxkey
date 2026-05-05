import type { AppEnv } from '../../config/env'
import { ExternalServiceError } from '../../errors/app-error'
import { createAiClient, getAiModel } from '../aiClient'
import type {
  GenerateStructuredTriageInput,
  GenerateStructuredTriageResult,
  LLMProvider,
} from './types'
import { generateStructuredOutput } from './provider-utils'

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>
    }
  }>
}

export class OpenAIProvider implements LLMProvider {
  private readonly aiClient

  constructor(private readonly env: AppEnv) {
    this.aiClient = createAiClient(env)
  }

  private async callModel(prompt: string): Promise<string> {
    try {
      const payload = (await this.aiClient.chat.completions.create({
        model: getAiModel(this.env),
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You return JSON only. Never include markdown fences, prose, or extra explanation.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      })) as OpenAIChatResponse
      const content = payload.choices?.[0]?.message?.content

      if (typeof content === 'string') {
        return content
      }

      if (Array.isArray(content)) {
        return content
          .filter((item) => item.type === 'text' && item.text)
          .map((item) => item.text)
          .join('\n')
      }

      throw new ExternalServiceError('OpenAI response did not include model content')
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error
      }

      throw new ExternalServiceError('OpenAI request failed')
    }
  }

  async generateStructuredTriage(
    input: GenerateStructuredTriageInput,
  ): Promise<GenerateStructuredTriageResult> {
    return generateStructuredOutput({
      input,
      executePrompt: (prompt) => this.callModel(prompt),
      modelProvider: this.env.effectiveLlmProvider,
      modelName: this.env.effectiveOpenAiModel ?? 'unknown',
    })
  }
}
