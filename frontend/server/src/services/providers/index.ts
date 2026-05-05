import type { AppEnv } from '../../config/env'
import { AnthropicProvider } from './anthropic.provider'
import { MockProvider } from './mock.provider'
import { OpenAIProvider } from './openai.provider'
import type { LLMProvider } from './types'

export function createLLMProvider(env: AppEnv): LLMProvider {
  switch (env.effectiveLlmProvider) {
    case 'openai':
    case 'groq':
      return new OpenAIProvider(env)
    case 'anthropic':
      return new AnthropicProvider()
    case 'mock':
    default:
      return new MockProvider()
  }
}
