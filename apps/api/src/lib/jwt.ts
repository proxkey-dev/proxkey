import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "proxkey_session";
const ISSUER = "proxkey";
const AUDIENCE = "proxkey-api";

export interface SessionTokenPayload {
  githubLogin: string;
  email: string;
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(
  payload: SessionTokenPayload,
  secret: string,
  ttlSeconds = 60 * 60 * 24 * 7,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.githubLogin)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .sign(secretKey(secret));
}

export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionTokenPayload> {
  const { payload } = await jwtVerify(token, secretKey(secret), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (typeof payload.sub !== "string" || typeof payload["email"] !== "string") {
    throw new Error("Invalid session token");
  }
  return { githubLogin: payload.sub, email: payload["email"] };
}
