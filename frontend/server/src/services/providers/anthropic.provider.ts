import { ExternalServiceError } from '../../errors/app-error'
import type {
  GenerateStructuredTriageInput,
  GenerateStructuredTriageResult,
  LLMProvider,
} from './types'

export class AnthropicProvider implements LLMProvider {
  async generateStructuredTriage(
    _input: GenerateStructuredTriageInput,
  ): Promise<GenerateStructuredTriageResult> {
    throw new ExternalServiceError('Anthropic provider is not implemented yet')
  }
}
