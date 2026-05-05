import { Provider } from "@proxkey/db";
import { describe, expect, it } from "vitest";
import { buildIngestJobPayloadSchema } from "./index.js";

describe("buildIngestJobPayloadSchema", () => {
  it("parses a valid payload", () => {
    const parsed = buildIngestJobPayloadSchema.parse({
      provider: Provider.GITHUB_ACTIONS,
      repoFullName: "acme/app",
      buildExternalId: "run-1",
      payload: { action: "completed" },
    });
    expect(parsed.buildExternalId).toBe("run-1");
  });
});
