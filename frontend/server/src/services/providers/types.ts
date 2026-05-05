import type { z } from 'zod'
import type { triageModelOutputSchema } from '../../schemas/triage.schemas'

export type TriageModelOutput = z.output<typeof triageModelOutputSchema>

export type GenerateStructuredTriageInput = {
  reportId: string
  title: string
  sourceType: string
  redactedText: string
}

export type GenerateStructuredTriageResult = {
  output: TriageModelOutput
  rawOutput: string
  modelProvider: string
  modelName: string
}

export interface LLMProvider {
  generateStructuredTriage(
    input: GenerateStructuredTriageInput,
  ): Promise<GenerateStructuredTriageResult>
}
