import { ZodError, type ZodType, type ZodTypeAny, z } from 'zod'
import { ValidationError } from '../errors/app-error'

function formatZodError(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : 'root',
    message: issue.message,
  }))
}

export function validateSchema<T>(schema: ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value)

  if (!result.success) {
    throw new ValidationError(`${label} validation failed`, formatZodError(result.error))
  }

  return result.data
}

export function validateRequest<
  TBodySchema extends ZodTypeAny | undefined = undefined,
  TParamsSchema extends ZodTypeAny | undefined = undefined,
  TQuerySchema extends ZodTypeAny | undefined = undefined,
>(args: {
  bodySchema?: TBodySchema
  paramsSchema?: TParamsSchema
  querySchema?: TQuerySchema
  body?: unknown
  params?: unknown
  query?: unknown
}): {
  body: TBodySchema extends ZodTypeAny ? z.infer<TBodySchema> : undefined
  params: TParamsSchema extends ZodTypeAny ? z.infer<TParamsSchema> : undefined
  query: TQuerySchema extends ZodTypeAny ? z.infer<TQuerySchema> : undefined
} {
  return {
    body: args.bodySchema ? validateSchema(args.bodySchema, args.body, 'Body') : undefined,
    params: args.paramsSchema
      ? validateSchema(args.paramsSchema, args.params, 'Params')
      : undefined,
    query: args.querySchema ? validateSchema(args.querySchema, args.query, 'Query') : undefined,
  }
}
