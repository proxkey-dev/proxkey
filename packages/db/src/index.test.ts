import { describe, expect, it } from "vitest";

describe("@proxkey/db", () => {
  it("exports PrismaClient symbol", async () => {
    const mod = await import("./index.js");
    expect(mod.PrismaClient).toBeDefined();
  });
});
