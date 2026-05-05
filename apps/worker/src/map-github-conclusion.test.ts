import { BuildConclusion } from "@proxkey/db";
import { describe, expect, it } from "vitest";
import { mapGitHubWorkflowConclusion } from "./map-github-conclusion.js";

describe("mapGitHubWorkflowConclusion", () => {
  it("maps known conclusions", () => {
    expect(mapGitHubWorkflowConclusion("success")).toBe(
      BuildConclusion.SUCCESS,
    );
    expect(mapGitHubWorkflowConclusion("failure")).toBe(
      BuildConclusion.FAILURE,
    );
    expect(mapGitHubWorkflowConclusion(null)).toBeNull();
  });
});
