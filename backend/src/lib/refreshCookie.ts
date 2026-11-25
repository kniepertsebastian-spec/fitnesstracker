import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../config/env.js";
import { REFRESH_COOKIE_NAME, REFRESH_TOKEN_TTL_MS } from "./tokens.js";

// The refresh cookie is only ever sent to the auth routes.
export const REFRESH_COOKIE_PATH = "/api/auth";

/**
 * The Domain attribute for a request to `hostname`: the configured parent domain when the host lies
 * under it (fitness.pwa-tree.de, kcal.pwa-tree.de, or pwa-tree.de itself), otherwise none — a
 * browser rejects a cookie whose Domain doesn't match the host, which would silently break the login
 * on localhost or on any other hostname the backend is reached by.
 */
export function cookieDomainFor(hostname: string | undefined, configuredDomain: string): string | undefined {
  if (!configuredDomain || !hostname) return undefined;
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === configuredDomain || host.endsWith(`.${configuredDomain}`)) return configuredDomain;
  return undefined;
}

/**
 * Sets the refresh cookie. With COOKIE_DOMAIN (cookie SSO) the cookie is scoped to the parent domain,
 * so the Kalorientracker on its own subdomain sees the session the Fitnesstracker created and vice
 * versa. The same response also deletes a host-only cookie of the same name: sessions from before the
 * switch still carry one, and as the older cookie the browser would send it first — a stale, already
 * rotated token that would end the session once the grace period ran out.
 *
 * SameSite stays Strict: both apps are subdomains of one registrable domain, i.e. same-site, so the
 * cookie still travels between them; it only stays home on cross-site requests.
 */
export function setRefreshCookie(
  request: FastifyRequest,
  reply: FastifyReply,
  token: string,
  configuredDomain: string = env.COOKIE_DOMAIN,
): void {
  const domain = cookieDomainFor(request.hostname, configuredDomain);
  reply.setCookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_MS / 1000,
    ...(domain ? { domain } : {}),
  });
  if (domain) reply.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}

/** Deletes the refresh cookie in every scope it may exist in (host-only and, with SSO, the parent domain). */
export function clearRefreshCookie(
  request: FastifyRequest,
  reply: FastifyReply,
  configuredDomain: string = env.COOKIE_DOMAIN,
): void {
  reply.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  const domain = cookieDomainFor(request.hostname, configuredDomain);
  if (domain) reply.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH, domain });
}
