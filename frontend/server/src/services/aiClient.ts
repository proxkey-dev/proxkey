import OpenAI from 'openai'
import type { AppEnv } from '../config/env'

export function createAiClient(env: AppEnv): OpenAI {
  return new OpenAI({
    apiKey: env.effectiveOpenAiApiKey,
    baseURL: env.effectiveOpenAiBaseUrl,
  })
}

export function getAiModel(env: AppEnv): string {
  return env.effectiveOpenAiModel || 'llama-3.3-70b-versatile'
}
