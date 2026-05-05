/**
 * Single source of truth for error responses. Every API error must
 * be the shape { error: string, code: string } per spec.
 */

export interface StructuredError {
  error: string;
  code: string;
}

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  public constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }

  public toResponse(): StructuredError {
    return { error: this.message, code: this.code };
  }
}

export const errors = {
  badRequest: (code: string, message: string): HttpError =>
    new HttpError(400, code, message),
  unauthorized: (
    code = "UNAUTHENTICATED",
    message = "Authentication required",
  ): HttpError => new HttpError(401, code, message),
  forbidden: (code = "FORBIDDEN", message = "Forbidden"): HttpError =>
    new HttpError(403, code, message),
  notFound: (code = "NOT_FOUND", message = "Not found"): HttpError =>
    new HttpError(404, code, message),
  conflict: (code: string, message: string): HttpError =>
    new HttpError(409, code, message),
  rateLimited: (
    code = "RATE_LIMITED",
    message = "Too many requests",
  ): HttpError => new HttpError(429, code, message),
  internal: (
    code = "INTERNAL",
    message = "Internal server error",
  ): HttpError => new HttpError(500, code, message),
};
