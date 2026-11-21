const ALLOWED_PROTOCOLS = new Set(["https:", "http:"]);

// Defense-in-depth for links whose target comes from data (e.g. an exercise's video URL from the
// catalog import or the edit form): only absolute http(s) URLs may become an href. Anything else —
// `javascript:`, `data:`, relative paths, garbage — yields null, so the caller renders no link.
export function safeExternalUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return ALLOWED_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
