import { useEffect, useRef, useState } from "react";
import { apiFetchBlob } from "../../api/client";

interface Props {
  latestPhotoId: string | null;
  onCapture: (file: File) => void;
  onCancel: () => void;
  // Called once if the camera can't be used at all (no getUserMedia support, permission denied,
  // no device) — the parent falls back to the plain file input rather than getting stuck on a
  // dead camera view.
  onUnavailable: (reason: string) => void;
}

// Live camera preview with the most recent progress photo overlaid semi-transparently, so the
// next photo can be lined up (pose/distance/framing) against the last one before capturing.
// Captures by drawing the current video frame to a canvas rather than any native camera UI,
// which is what makes the overlay possible in the first place.
export function ProgressPhotoCamera({ latestPhotoId, onCapture, onCancel, onUnavailable }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [overlaySrc, setOverlaySrc] = useState<string | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0.4);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!latestPhotoId) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    apiFetchBlob(`/progress-photos/${latestPhotoId}/file`).then((blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setOverlaySrc(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [latestPhotoId]);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        onUnavailable("Kamera-Zugriff wird von diesem Browser nicht unterstützt.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          onUnavailable(
            err instanceof DOMException && err.name === "NotAllowedError"
              ? "Kamera-Zugriff wurde verweigert."
              : "Kamera konnte nicht gestartet werden.",
          );
        }
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], "progress-photo.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ transform: facingMode === "user" ? "scaleX(-1)" : undefined }}
        />
        {overlaySrc && (
          <img
            src={overlaySrc}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            style={{ opacity: overlayOpacity }}
          />
        )}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-300">
            Kamera wird gestartet…
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 bg-ink-950 p-4">
        {overlaySrc && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-500">Vorheriges Foto</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(Number(e.target.value))}
              className="w-full"
            />
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-300 hover:bg-ink-800"
          >
            Abbrechen
          </button>
          <button
            onClick={handleCapture}
            disabled={!ready}
            aria-label="Foto aufnehmen"
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-ink-700 bg-white disabled:opacity-50"
          />
          <button
            onClick={() => setFacingMode((m) => (m === "environment" ? "user" : "environment"))}
            className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-300 hover:bg-ink-800"
          >
            Kamera wechseln
          </button>
        </div>
      </div>
    </div>
  );
}
