import { generateStructuredOutput } from './provider-utils'
import type {
  GenerateStructuredTriageInput,
  GenerateStructuredTriageResult,
  LLMProvider,
} from './types'

type MockMode = 'success' | 'invalid-json-once' | 'always-invalid-json' | 'throw'

export class MockProvider implements LLMProvider {
  private attempts = 0

  constructor(private readonly mode: MockMode = 'success') {}

  private buildValidOutput(input: GenerateStructuredTriageInput): string {
    return JSON.stringify({
      summary: `Structured triage for ${input.title}`,
      issueType: 'BUG',
      severity: 'HIGH',
      confidenceScore: 0.87,
      customerImpact: 'Customers cannot complete the reported workflow reliably.',
      affectedArea: 'Checkout',
      suspectedComponent: 'payments-service',
      reproSteps: ['Open checkout', 'Enter payment details', 'Submit the form'],
      expectedBehavior: 'Checkout should complete successfully.',
      actualBehavior: 'The flow times out after submission.',
      missingInformation: ['Exact browser version'],
      suggestedOwner: 'payments-team',
      suggestedLabels: ['customer-impact', 'checkout'],
      duplicateSignals: ['Multiple timeout references in support reports'],
      duplicateCandidates: [
        {
          reportId: 'PK-1042',
          similarity: 0.91,
          summary: 'Checkout freezes after payment submit with timeout symptoms',
        },
      ],
      severityReasoning:
        'Checkout timeout blocks a core revenue path and affects customer completion.',
      nextAction:
        'Request session replay and compare timeout traces against the last known healthy deploy.',
      followUpMessage:
        'Can you provide the browser version, account ID, and any timeout trace or session replay from the failed run?',
      ticketTitle: `Investigate checkout timeout: ${input.title}`,
      ticketDescription: `Summary: Structured triage for ${input.title}`,
    })
  }

  async generateStructuredTriage(
    input: GenerateStructuredTriageInput,
  ): Promise<GenerateStructuredTriageResult> {
    if (this.mode === 'throw') {
      throw new Error('Mock provider failure')
    }

    return generateStructuredOutput({
      input,
      modelProvider: 'mock',
      modelName: 'mock-triage',
      executePrompt: async () => {
        this.attempts += 1

        if (this.mode === 'always-invalid-json') {
          return 'not valid json'
        }

        if (this.mode === 'invalid-json-once' && this.attempts === 1) {
          return 'invalid json response'
        }

        return this.buildValidOutput(input)
      },
    })
  }
}
