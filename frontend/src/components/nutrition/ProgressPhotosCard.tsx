import { useState, type ChangeEvent } from "react";
import { ApiError } from "../../api/client";
import { useDeleteProgressPhoto, useProgressPhotos, useUploadProgressPhoto } from "../../hooks/useProgressPhotos";
import { ProgressPhotoImage } from "./ProgressPhotoImage";
import { ProgressPhotoCamera } from "./ProgressPhotoCamera";
import { Camera, ImagePlus, X } from "lucide-react";
import { Button, Callout, Card, EmptyState, Field, IconButton, Input, Select, Skeleton } from "../ui";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function todayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
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
  // Defaults to today but stays editable — the backend/upload plumbing already accepted a custom
  // `takenAt` (see progressPhoto.routes.ts), but no UI ever exposed it, so backdating an older
  // photo (e.g. importing a phone's camera roll history) was impossible even though the pieces
  // to support it already existed.
  const [takenAt, setTakenAt] = useState(todayDateInputValue);

  const uploadFile = async (file: File) => {
    setError(null);
    try {
      await upload.mutateAsync({ file, takenAt: takenAt ? new Date(takenAt).toISOString() : undefined });
      setTakenAt(todayDateInputValue());
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

      <Card title="Neues Vergleichsfoto" className="lg:max-w-xl">
        <Field label="Datum" className="mb-3">
          {(p) => <Input {...p} type="date" value={takenAt} max={todayDateInputValue()} onChange={(e) => setTakenAt(e.target.value)} />}
        </Field>
        <div className="flex gap-2">
          <Button
            variant="dashed"
            size="lg"
            className="flex-1"
            iconLeft={<Camera size={18} aria-hidden />}
            disabled={upload.isPending}
            onClick={() => {
              setCameraUnavailable(null);
              setCameraOpen(true);
            }}
          >
            {upload.isPending ? "Lädt hoch…" : "Kamera mit Vorher-Vergleich"}
          </Button>
          <label
            className={`inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-border-strong bg-control px-4 text-body font-medium text-text transition-colors duration-150 hover:bg-track focus-within:outline focus-within:outline-2 focus-within:outline-accent ${upload.isPending ? "pointer-events-none opacity-50" : ""}`}
          >
            <ImagePlus size={18} aria-hidden />
            Datei
            <input type="file" accept="image/*" className="sr-only" onChange={handleFileChange} disabled={upload.isPending} />
          </label>
        </div>
        {cameraUnavailable && (
          <Callout tone="warning" className="mt-3">
            {cameraUnavailable} Nutze stattdessen „Datei“.
          </Callout>
        )}
        {error && (
          <Callout tone="danger" className="mt-3">
            {error}
          </Callout>
        )}
      </Card>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon={<Camera size={18} aria-hidden />} text="Noch keine Fotos. Nur du kannst sie sehen." />
        </Card>
      ) : (
        <>
          <Card title="Galerie">
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
              {items.map((photo) => (
                <div key={photo.id} className="relative">
                  <ProgressPhotoImage id={photo.id} alt={formatDate(photo.takenAt)} className="aspect-square w-full rounded-lg object-cover" />
                  <p className="mt-1 text-center text-xs text-text-faint">{formatDate(photo.takenAt)}</p>
                  <IconButton
                    onClick={() => deletePhoto.mutate(photo.id)}
                    className="absolute right-1 top-1 h-9 w-9 rounded-full bg-bg"
                    aria-label={`Foto vom ${formatDate(photo.takenAt)} löschen`}
                  >
                    <X size={14} aria-hidden />
                  </IconButton>
                </div>
              ))}
            </div>
          </Card>

          {items.length >= 2 && (
            <Card title="Vorher/Nachher">
              <div className="grid grid-cols-2 gap-3">
                <Select aria-label="Vorher-Foto" value={beforeId} onChange={(e) => setBeforeId(e.target.value)}>
                  <option value="">Vorher wählen…</option>
                  {items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatDate(p.takenAt)}
                    </option>
                  ))}
                </Select>
                <Select aria-label="Nachher-Foto" value={afterId} onChange={(e) => setAfterId(e.target.value)}>
                  <option value="">Nachher wählen…</option>
                  {items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatDate(p.takenAt)}
                    </option>
                  ))}
                </Select>
              </div>
              {before && after && (
                <div className="mt-3 grid grid-cols-2 gap-3 lg:max-w-xl">
                  <ProgressPhotoImage id={before.id} alt="Vorher" className="w-full rounded-lg object-cover" />
                  <ProgressPhotoImage id={after.id} alt="Nachher" className="w-full rounded-lg object-cover" />
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
