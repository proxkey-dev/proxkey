import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { errors } from "../../lib/errors.js";
import { SESSION_COOKIE, signSessionToken } from "../../lib/jwt.js";

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

const STATE_COOKIE = "proxkey_oauth_state";
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

interface GithubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GithubUser {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
}

interface GithubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

async function exchangeCodeForToken(
  code: string,
  env: FastifyInstance["proxkeyEnv"],
): Promise<string> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  if (!res.ok) {
    throw errors.badRequest(
      "OAUTH_EXCHANGE_FAILED",
      "GitHub token exchange failed",
    );
  }
  const body = (await res.json()) as GithubTokenResponse;
  if (!body.access_token) {
    throw errors.badRequest(
      "OAUTH_EXCHANGE_FAILED",
      body.error_description ?? "GitHub did not return an access token",
    );
  }
  return body.access_token;
}

async function fetchGithubUser(accessToken: string): Promise<{
  login: string;
  email: string;
  name: string;
}> {
  const headers = {
    authorization: `Bearer ${accessToken}`,
    "user-agent": "proxkey-api",
    accept: "application/vnd.github+json",
  };

  const userRes = await fetch("https://api.github.com/user", { headers });
  if (!userRes.ok) {
    throw errors.badRequest("OAUTH_USER_FAILED", "Could not load GitHub user");
  }
  const user = (await userRes.json()) as GithubUser;

  let email = user.email;
  if (!email) {
    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers,
    });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as GithubEmail[];
      email =
        emails.find((e) => e.primary && e.verified)?.email ??
        emails.find((e) => e.verified)?.email ??
        null;
    }
  }
  if (!email) {
    throw errors.badRequest(
      "EMAIL_REQUIRED",
      "GitHub did not return a verified email address",
    );
  }

  return {
    login: user.login,
    email,
    name: user.name ?? user.login,
  };
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/auth/github", async (_request, reply) => {
    const env = app.proxkeyEnv;
    const state = randomBytes(16).toString("hex");
    const redirectUri = `${env.API_URL}/api/auth/github/callback`;
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "read:user user:email");

    void reply
      .setCookie(STATE_COOKIE, state, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        maxAge: 600,
      })
      .redirect(url.toString());
  });

  app.get("/api/auth/github/callback", async (request, reply) => {
    const env = app.proxkeyEnv;
    const query = callbackQuerySchema.parse(request.query);
    const cookieState = request.cookies[STATE_COOKIE];
    if (!cookieState || cookieState !== query.state) {
      throw errors.badRequest("OAUTH_STATE_MISMATCH", "OAuth state mismatch");
    }
    void reply.clearCookie(STATE_COOKIE, { path: "/" });

    const token = await exchangeCodeForToken(query.code, env);
    const ghUser = await fetchGithubUser(token);

    const org = await app.prisma.org.upsert({
      where: { githubLogin: ghUser.login },
      create: {
        githubLogin: ghUser.login,
        name: ghUser.name,
      },
      update: {
        name: ghUser.name,
        deletedAt: null,
      },
    });

    await app.prisma.orgMember.upsert({
      where: {
        orgId_githubLogin: {
          orgId: org.id,
          githubLogin: ghUser.login,
        },
      },
      create: {
        orgId: org.id,
        githubLogin: ghUser.login,
        role: "owner",
      },
      update: {},
    });

    const sessionToken = await signSessionToken(
      { githubLogin: ghUser.login, email: ghUser.email },
      env.JWT_SECRET,
      ONE_WEEK_SECONDS,
    );

    void reply
      .setCookie(SESSION_COOKIE, sessionToken, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        maxAge: ONE_WEEK_SECONDS,
      })
      .redirect(`${env.APP_URL}/`);
  });

  app.post("/api/auth/logout", async (_request, reply) => {
    void reply
      .clearCookie(SESSION_COOKIE, { path: "/" })
      .send({ ok: true });
  });

  app.get(
    "/api/auth/me",
    {
      preHandler: async (request) => {
        await app.requireAuth(request);
      },
    },
    async (request) => {
      const members = await app.prisma.orgMember.findMany({
        where: {
          githubLogin: request.user!.githubLogin,
          org: { deletedAt: null },
        },
        include: {
          org: { select: { id: true, name: true, plan: true } },
        },
      });

      return {
        githubLogin: request.user!.githubLogin,
        email: request.user!.email,
        orgs: members.map((m) => ({
          id: m.org.id,
          name: m.org.name,
          plan: m.org.plan,
          role: m.role,
        })),
      };
    },
  );
}
