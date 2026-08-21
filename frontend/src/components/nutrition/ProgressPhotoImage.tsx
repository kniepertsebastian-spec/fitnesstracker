import { useEffect, useState } from "react";
import { apiFetchBlob } from "../../api/client";

// Photos are private, so they're never a plain <img src="/api/..."> — that can't carry the
// Bearer token. Fetch each one as an authenticated blob instead and hand the browser an object
// URL, revoked on unmount/id-change to avoid leaking memory across a long gallery session.
export function ProgressPhotoImage({
  id,
  alt,
  className,
}: {
  id: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    apiFetchBlob(`/progress-photos/${id}/file`).then((blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (!src) {
    return <div className={`animate-pulse bg-ink-800 ${className ?? ""}`} />;
  }

  return <img src={src} alt={alt} className={className} />;
}
