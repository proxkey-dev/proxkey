import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import type { Env } from "@proxkey/config/env";

/**
 * Authenticate as a specific GitHub App installation. Token caching
 * is handled by @octokit/auth-app — we get a fresh installation token
 * the first time and reuse it until it nears expiry.
 */
export function makeInstallationOctokit(
  env: Pick<Env, "GITHUB_APP_ID" | "GITHUB_APP_PRIVATE_KEY">,
  installationId: number | string,
): Octokit {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_APP_PRIVATE_KEY,
      installationId: Number(installationId),
    },
  });
}
