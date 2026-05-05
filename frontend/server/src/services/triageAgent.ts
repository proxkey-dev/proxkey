import { z } from 'zod'
import type { AppEnv } from '../config/env'
import { createAiClient, getAiModel } from './aiClient'
import { ExternalServiceError } from '../errors/app-error'

const AdHocTriageSchema = z.object({
  summary: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  component: z.string(),
  repro_steps: z.array(z.string()),
  missing_info: z.array(z.string()),
  suggested_owner: z.string(),
  next_action: z.string(),
  confidence: z.number().min(0).max(1),
})

export type AdHocTriageResult = z.output<typeof AdHocTriageSchema>

export async function runTriageAgent(args: {
  env: AppEnv
  rawInput: string
}): Promise<AdHocTriageResult> {
  const aiClient = createAiClient(args.env)

  const completion = await aiClient.chat.completions.create({
    model: getAiModel(args.env),
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'You are ProxKey, an engineering triage agent.',
          'Return ONLY valid JSON.',
          'Do not include markdown.',
          'Analyze bug reports, logs, support tickets, and QA notes.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          'Triage this report:',
          args.rawInput,
          'Return this JSON shape:',
          JSON.stringify({
            summary: 'string',
            severity: 'low | medium | high | critical',
            component: 'string',
            repro_steps: ['string'],
            missing_info: ['string'],
            suggested_owner: 'string',
            next_action: 'string',
            confidence: 0.82,
          }),
        ].join('\n'),
      },
    ],
  })

  const text = completion.choices[0]?.message?.content ?? ''

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ExternalServiceError('AI returned invalid JSON')
  }

  return AdHocTriageSchema.parse(parsed)
}
