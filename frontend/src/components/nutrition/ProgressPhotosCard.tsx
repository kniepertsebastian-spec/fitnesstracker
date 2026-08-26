import { useState, type ChangeEvent } from "react";
import { ApiError } from "../../api/client";
import { useDeleteProgressPhoto, useProgressPhotos, useUploadProgressPhoto } from "../../hooks/useProgressPhotos";
import { ProgressPhotoImage } from "./ProgressPhotoImage";
import { ProgressPhotoCamera } from "./ProgressPhotoCamera";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function ProgressPhotosCard() {
  const { data: photos, isLoading } = useProgressPhotos();
  const upload = useUploadProgressPhoto();
  const deletePhoto = useDeleteProgressPhoto();

  const [error, setError] = useState<string | null>(null);
  const [beforeId, setBeforeId] = useState("");
  const [afterId, setAfterId] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraUnavailable, setCameraUnavailable] = useState<string | null>(null);

  const uploadFile = async (file: File) => {
    setError(null);
    try {
      await upload.mutateAsync({ file });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Konnte nicht hochgeladen werden.");
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await uploadFile(file);
  };

  const items = photos ?? [];
  const before = items.find((p) => p.id === beforeId);
  const after = items.find((p) => p.id === afterId);

  return (
    <div className="flex flex-col gap-4">
      {cameraOpen && (
        <ProgressPhotoCamera
          latestPhotoId={items[0]?.id ?? null}
          onCancel={() => setCameraOpen(false)}
          onCapture={async (file) => {
            setCameraOpen(false);
            await uploadFile(file);
          }}
          onUnavailable={(reason) => {
            setCameraOpen(false);
            setCameraUnavailable(reason);
          }}
        />
      )}

      <div className="rounded-lg border border-ink-800 bg-ink-900 p-4">
        <p className="mb-2 text-sm font-medium text-ink-300">Neues Vergleichsfoto</p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setCameraUnavailable(null);
              setCameraOpen(true);
            }}
            disabled={upload.isPending}
            className="flex-1 rounded-lg border border-dashed border-ink-700 bg-ink-950 py-4 text-sm text-ink-400 hover:border-violet-500 disabled:opacity-50"
          >
            {upload.isPending ? "Lädt hoch…" : "Kamera mit Vorher-Vergleich"}
          </button>
          <label className="flex cursor-pointer items-center justify-center rounded-lg border border-ink-700 bg-ink-950 px-4 text-sm text-ink-400 hover:border-violet-500">
            Datei
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={upload.isPending}
            />
          </label>
        </div>
        {cameraUnavailable && (
          <p className="mt-1 text-xs text-amber-500">{cameraUnavailable} Nutze stattdessen "Datei".</p>
        )}
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>

      {isLoading ? (
        <p className="text-ink-500">Lädt…</p>
      ) : items.length === 0 ? (
        <p className="text-ink-500">Noch keine Fotos. Nur du kannst sie sehen.</p>
      ) : (
        <>
          <div>
            <h2 className="mb-2 text-sm font-medium text-ink-400">Galerie</h2>
            <div className="grid grid-cols-3 gap-2">
              {items.map((photo) => (
                <div key={photo.id} className="relative">
                  <ProgressPhotoImage
                    id={photo.id}
                    alt={formatDate(photo.takenAt)}
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                  <p className="mt-1 text-center text-xs text-ink-500">{formatDate(photo.takenAt)}</p>
                  <button
                    onClick={() => deletePhoto.mutate(photo.id)}
                    className="absolute right-1 top-1 rounded-full bg-ink-950/80 px-1.5 py-0.5 text-xs text-red-400"
                    aria-label="Foto löschen"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {items.length >= 2 && (
            <div>
              <h2 className="mb-2 text-sm font-medium text-ink-400">Vorher/Nachher</h2>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={beforeId}
                  onChange={(e) => setBeforeId(e.target.value)}
                  className="rounded-lg border border-ink-700 bg-ink-950 px-2 py-1.5 text-sm"
                >
                  <option value="">Vorher wählen…</option>
                  {items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatDate(p.takenAt)}
                    </option>
                  ))}
                </select>
                <select
                  value={afterId}
                  onChange={(e) => setAfterId(e.target.value)}
                  className="rounded-lg border border-ink-700 bg-ink-950 px-2 py-1.5 text-sm"
                >
                  <option value="">Nachher wählen…</option>
                  {items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatDate(p.takenAt)}
                    </option>
                  ))}
                </select>
              </div>
              {before && after && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <ProgressPhotoImage id={before.id} alt="Vorher" className="w-full rounded-lg object-cover" />
                  <ProgressPhotoImage id={after.id} alt="Nachher" className="w-full rounded-lg object-cover" />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
