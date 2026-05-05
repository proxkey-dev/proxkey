import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

describe("parseEnv", () => {
  it("accepts a valid environment", () => {
    const env = parseEnv({
      DATABASE_URL: "postgresql://proxkey:proxkey@localhost:5432/proxkey",
      REDIS_URL: "redis://localhost:6379",
      GITHUB_APP_ID: "123",
      GITHUB_APP_PRIVATE_KEY: "-----BEGIN RSA PRIVATE KEY-----\\nMIIB\\n-----END RSA PRIVATE KEY-----",
      GITHUB_WEBHOOK_SECRET: "whsec_test",
      GITHUB_CLIENT_ID: "client",
      GITHUB_CLIENT_SECRET: "secret",
      RESEND_API_KEY: "re_123",
      JWT_SECRET: "01234567890123456789012345678901",
      APP_URL: "https://proxkey.dev",
      API_URL: "https://api.proxkey.dev",
    });
    expect(env.GITHUB_APP_PRIVATE_KEY).toContain("\n");
  });

  it("throws a readable error when vars are missing", () => {
    expect(() => parseEnv({})).toThrow(/Invalid or missing environment variables/);
  });
});
