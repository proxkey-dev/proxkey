import { describe, expect, it } from "vitest";
import { HttpError, errors } from "./errors.js";

describe("errors", () => {
  it("creates structured http errors", () => {
    const err = errors.badRequest("TEST", "message");
    expect(err).toBeInstanceOf(HttpError);
    expect(err.toResponse()).toEqual({ error: "message", code: "TEST" });
  });
});
