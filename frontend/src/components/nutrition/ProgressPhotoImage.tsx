import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import { ApiError, apiFetchBlob } from "../../api/client";
import { cn } from "../ui";

// Start fetching a little before the photo scrolls into view, so it's usually ready in time.
const PREFETCH_MARGIN = "200px";

type LoadResult = { id: string; src: string } | { id: string; error: "offline" | "unavailable" };

// Photos are private, so they're never a plain <img src="/api/..."> — that can't carry the
// Bearer token. Fetch each one as an authenticated blob instead and hand the browser an object
// URL, revoked on unmount/id-change to avoid leaking memory across a long gallery session.
// The fetch only starts once the photo is near the viewport, so opening a long gallery doesn't
// pull every photo at once; a failed fetch (offline, 404, 5xx) shows a fallback instead of a
// skeleton that pulses forever.
export function ProgressPhotoImage({
  id,
  alt,
  className,
}: {
  id: string;
  alt: string;
  className?: string;
}) {
  const placeholderRef = useRef<HTMLDivElement>(null);
  // Without IntersectionObserver (very old browsers) just load right away.
  const [nearViewport, setNearViewport] = useState(() => typeof IntersectionObserver === "undefined");
  const [result, setResult] = useState<LoadResult | null>(null);

  useEffect(() => {
    if (nearViewport) return;
    const el = placeholderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: PREFETCH_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nearViewport]);

  useEffect(() => {
    if (!nearViewport) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    apiFetchBlob(`/progress-photos/${id}/file`)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setResult({ id, src: objectUrl });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // An ApiError means the server answered (404/5xx); anything else is a network failure.
        const offline = !(err instanceof ApiError) || (typeof navigator !== "undefined" && !navigator.onLine);
        setResult({ id, error: offline ? "offline" : "unavailable" });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, nearViewport]);

  // Callers without an aspect-ratio class (e.g. the before/after comparison) get a fixed portrait
  // box, so skeleton, fallback and loaded photo all take the same space — no layout shift.
  const sizeClass = cn(!/(^|\s)aspect-/.test(className ?? "") && "aspect-3/4", className);
  const current = result && result.id === id ? result : null;

  if (current && "src" in current) {
    return <img src={current.src} alt={alt} decoding="async" className={sizeClass} />;
  }

  if (current && "error" in current) {
    const message = current.error === "offline" ? "Foto offline nicht verfügbar" : "Foto nicht verfügbar";
    return (
      <div
        role="img"
        aria-label={`${alt}: ${message}`}
        className={cn("flex flex-col items-center justify-center gap-1 bg-track p-2 text-center text-xs text-text-subtle", sizeClass)}
      >
        <ImageOff size={18} aria-hidden />
        <span aria-hidden>{message}</span>
      </div>
    );
  }

  return <div ref={placeholderRef} aria-hidden className={cn("animate-pulse bg-track", sizeClass)} />;
}
