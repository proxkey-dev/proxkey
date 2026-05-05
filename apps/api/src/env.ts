import { z } from "zod";
import { parseEnv as parseSharedEnv } from "@proxkey/config/env";

const apiOnlySchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  CORS_ORIGINS: z
    .string()
    .default(
      "https://proxkey.dev,https://www.proxkey.dev,https://app.proxkey.dev,http://localhost:5173,http://localhost:3000",
    ),
});

export type ApiEnv = z.infer<typeof apiOnlySchema> & ReturnType<typeof parseSharedEnv>;

export function loadEnv(env: NodeJS.ProcessEnv = process.env): ApiEnv {
  const shared = parseSharedEnv(env);
  const local = apiOnlySchema.parse(env);
  return { ...shared, ...local };
}

export function corsOrigins(env: ApiEnv): string[] {
  return env.CORS_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
