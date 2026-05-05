import { BuildConclusion } from "@proxkey/db";

export function mapGitHubWorkflowConclusion(
  raw: string | null | undefined,
): BuildConclusion | null {
  if (!raw) {
    return null;
  }
  const v = raw.toLowerCase();
  if (v === "success") {
    return BuildConclusion.SUCCESS;
  }
  if (v === "failure" || v === "startup_failure") {
    return BuildConclusion.FAILURE;
  }
  if (v === "cancelled") {
    return BuildConclusion.CANCELLED;
  }
  if (v === "timed_out") {
    return BuildConclusion.TIMED_OUT;
  }
  return null;
}
