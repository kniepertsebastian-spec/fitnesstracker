// Every outgoing request gets a deadline: without one a hanging upstream (AI provider, dataset
// host, image CDN) keeps the request — and its memory — alive until the process dies.
export const OUTGOING_TIMEOUT_MS = 60_000;

export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

/** `fetch` that aborts after `timeoutMs` (the deadline also covers reading the body). */
export function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs = OUTGOING_TIMEOUT_MS,
): Promise<Response> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
}

/** Human-readable reason for a failed outgoing request, with a dedicated text for timeouts. */
export function describeFetchError(error: unknown, timeoutMs = OUTGOING_TIMEOUT_MS): string {
  if (isTimeoutError(error)) {
    return `keine Antwort innerhalb von ${Math.round(timeoutMs / 1000)} Sekunden`;
  }
  return error instanceof Error ? error.message : String(error);
}
