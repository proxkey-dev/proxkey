import type { FastifyInstance } from "fastify";
import { registerWebhookRoute } from "./webhook.js";
import { registerInstallationsRoute } from "./installations.js";

export async function registerGithubRoutes(
  app: FastifyInstance,
): Promise<void> {
  await registerWebhookRoute(app);
  await registerInstallationsRoute(app);
}
