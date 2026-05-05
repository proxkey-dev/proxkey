import { z } from "zod";

const privateKeySchema = z
  .string()
  .min(1, "GITHUB_APP_PRIVATE_KEY is required")
  .transform((v) => v.replace(/\\n/g, "\n"));

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
  REDIS_URL: z.string().url("REDIS_URL must be a valid URL"),
  GITHUB_APP_ID: z.string().min(1, "GITHUB_APP_ID is required"),
  GITHUB_APP_PRIVATE_KEY: privateKeySchema,
  GITHUB_WEBHOOK_SECRET: z.string().min(1, "GITHUB_WEBHOOK_SECRET is required"),
  GITHUB_CLIENT_ID: z.string().min(1, "GITHUB_CLIENT_ID is required"),
  GITHUB_CLIENT_SECRET: z.string().min(1, "GITHUB_CLIENT_SECRET is required"),
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  APP_URL: z.string().url("APP_URL must be a valid URL"),
  API_URL: z.string().url("API_URL must be a valid URL"),
});

export type Env = z.infer<typeof envSchema>;

function formatZodError(err: z.ZodError): string {
  return err.errors
    .map((e) => {
      const path = e.path.length ? e.path.join(".") : "(root)";
      return `${path}: ${e.message}`;
    })
    .join("\n");
}

/**
 * Validates process environment. Throws with a clear, human-readable message on failure.
 */
export function parseEnv(env: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = formatZodError(parsed.error);
    throw new Error(
      `Invalid or missing environment variables:\n${details}\n\nSee .env.example for required keys.`,
    );
  }
  return parsed.data;
}
