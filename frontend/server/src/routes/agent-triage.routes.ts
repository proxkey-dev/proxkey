import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { AppEnv } from '../config/env'
import { BadRequestError } from '../errors/app-error'
import { runTriageAgent } from '../services/triageAgent'

const bodySchema = z
  .object({
    input: z.string().trim().min(1),
  })
  .strict()

export function registerAgentTriageRoutes(app: FastifyInstance, env: AppEnv): void {
  app.post('/api/triage', async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body)

    if (!parsed.success) {
      throw new BadRequestError('Missing input')
    }

    const result = await runTriageAgent({
      env,
      rawInput: parsed.data.input,
    })

    reply.send({
      ok: true,
      result,
    })
  })
}
