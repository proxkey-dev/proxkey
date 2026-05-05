import { ExternalServiceError } from '../../errors/app-error'
import { triageModelOutputSchema } from '../../schemas/triage.schemas'
import type {
  GenerateStructuredTriageInput,
  GenerateStructuredTriageResult,
  TriageModelOutput,
} from './types'

type ExecutePrompt = (prompt: string) => Promise<string>

function buildInitialPrompt(input: GenerateStructuredTriageInput): string {
  return [
    'You are a backend triage classifier.',
    'Return JSON only. Do not wrap in markdown.',
    'Use this exact shape:',
    JSON.stringify({
      summary: 'string',
      issueType:
        'BUG|INCIDENT|OUTAGE|PERFORMANCE|SECURITY|DATA_QUALITY|CONFIGURATION|OTHER|UNKNOWN',
      severity: 'LOW|MEDIUM|HIGH|CRITICAL|UNKNOWN',
      confidenceScore: 0.5,
      customerImpact: 'string or null',
      affectedArea: 'string or null',
      suspectedComponent: 'string or null',
      reproSteps: ['string'],
      expectedBehavior: 'string or null',
      actualBehavior: 'string or null',
      missingInformation: ['string'],
      suggestedOwner: 'string or null',
      suggestedLabels: ['string'],
      duplicateSignals: ['string'],
      duplicateCandidates: [{ reportId: 'string', similarity: 0.91, summary: 'string' }],
      severityReasoning: 'string or null',
      nextAction: 'string',
      followUpMessage: 'string or null',
      ticketTitle: 'string',
      ticketDescription: 'string',
    }),
    `Report ID: ${input.reportId}`,
    `Title: ${input.title}`,
    `Source type: ${input.sourceType}`,
    'Redacted report body:',
    input.redactedText,
  ].join('\n')
}

function buildCorrectionPrompt(previousOutput: string): string {
  return [
    'Your previous response was invalid.',
    'Return only valid JSON matching the required schema.',
    'Do not include commentary or markdown.',
    'Previous response:',
    previousOutput,
  ].join('\n')
}

function parseStructuredOutput(rawOutput: string): TriageModelOutput {
  let parsedJson: unknown

  try {
    parsedJson = JSON.parse(rawOutput)
  } catch {
    throw new ExternalServiceError('LLM returned invalid JSON')
  }

  return triageModelOutputSchema.parse(parsedJson)
}

export async function generateStructuredOutput(args: {
  input: GenerateStructuredTriageInput
  executePrompt: ExecutePrompt
  modelProvider: string
  modelName: string
}): Promise<GenerateStructuredTriageResult> {
  const initialOutput = await args.executePrompt(buildInitialPrompt(args.input))

  try {
    return {
      output: parseStructuredOutput(initialOutput),
      rawOutput: initialOutput,
      modelProvider: args.modelProvider,
      modelName: args.modelName,
    }
  } catch {
    const correctedOutput = await args.executePrompt(buildCorrectionPrompt(initialOutput))

    try {
      return {
        output: parseStructuredOutput(correctedOutput),
        rawOutput: correctedOutput,
        modelProvider: args.modelProvider,
        modelName: args.modelName,
      }
    } catch {
      throw new ExternalServiceError('LLM returned invalid structured output')
    }
  }
}
