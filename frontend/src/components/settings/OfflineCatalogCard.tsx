import { useCallback, useEffect, useRef, useState } from "react";
import { DownloadCloud, RefreshCw, Trash2 } from "lucide-react";
import { EXERCISE_CATALOG_KEY, useExerciseCatalog } from "../../hooks/useExerciseLibrary";
import { syncExerciseCatalog } from "../../offline/exerciseCatalog";
import { clearPack, downloadPack, getPackStatus, storageEstimate, type PackProgress, type PackStatus } from "../../offline/exerciseImagePack";
import { requestPersistentStorage } from "../../lib/persistentStorage";
import { Button, Callout, Card, ProgressBar } from "../ui";
import { useQueryClient } from "@tanstack/react-query";

function formatMb(bytes: number) {
  return `${(bytes / (1024 * 1024)).toLocaleString("de-DE", { maximumFractionDigits: bytes > 100 * 1024 * 1024 ? 0 : 1 })} MB`;
}

// The exercise catalog and its pictures on this device: the list (names, descriptions, search) is kept
// automatically, the pictures can be downloaded in one go so the exercises look the same without signal.
export function OfflineCatalogCard() {
  const queryClient = useQueryClient();
  const { data: catalog } = useExerciseCatalog();
  const [status, setStatus] = useState<PackStatus | null>(null);
  const [progress, setProgress] = useState<PackProgress | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const abort = useRef<AbortController | null>(null);

  const refreshStatus = useCallback(async () => {
    if (catalog) setStatus(await getPackStatus(catalog));
    setStorage(await storageEstimate());
  }, [catalog]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => () => abort.current?.abort(), []);

  const update = async () => {
    setRefreshing(true);
    await syncExerciseCatalog(true);
    await queryClient.invalidateQueries({ queryKey: EXERCISE_CATALOG_KEY });
    setRefreshing(false);
  };

  const download = async () => {
    if (!catalog) return;
    setDownloading(true);
    setProgress(null);
    abort.current = new AbortController();
    // Hundreds of pictures are worth keeping: ask the browser not to throw them away under storage pressure.
    setPersisted(await requestPersistentStorage());
    await downloadPack(catalog, setProgress, abort.current.signal);
    setDownloading(false);
    await refreshStatus();
  };

  const remove = async () => {
    await clearPack();
    setProgress(null);
    await refreshStatus();
  };

  const complete = status !== null && status.total > 0 && status.cached >= status.total;
  const percent = progress && progress.total > 0 ? (progress.done / progress.total) * 100 : status && status.total > 0 ? (status.cached / status.total) * 100 : 0;

  return (
    <Card title="Übungen offline">
      <p className="text-small text-text-subtle">
        Die Übungsliste mit Namen, Beschreibungen und Suche liegt automatisch auf deinem Gerät. Die Bilder kannst du
        einmal laden, dann sehen die Übungen auch ohne Netz gleich aus.
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-small">
        <div>
          <dt className="text-text-subtle">Übungen</dt>
          <dd className="tabular font-numeric text-text">{catalog ? catalog.length : "…"}</dd>
        </div>
        <div>
          <dt className="text-text-subtle">Bilder</dt>
          <dd className="tabular font-numeric text-text">{status ? `${status.cached} von ${status.total}` : "…"}</dd>
        </div>
        {storage && (
          <div className="col-span-2">
            <dt className="text-text-subtle">Speicher der App</dt>
            <dd className="tabular font-numeric text-text">
              {formatMb(storage.usage)} von {formatMb(storage.quota)} möglichen
            </dd>
          </div>
        )}
      </dl>

      {(downloading || (status && status.total > 0 && !complete)) && (
        <ProgressBar className="mt-3" value={percent} size={6} label="Bilder offline" />
      )}
      {progress && !downloading && progress.failed > 0 && (
        <Callout tone="warning" className="mt-3">
          {progress.failed} Bilder konnten nicht geladen werden — bitte mit Netz noch einmal versuchen.
        </Callout>
      )}
      {complete && !downloading && <p className="mt-3 text-small text-accent-text">Alle Bilder sind offline verfügbar.</p>}
      {persisted === false && (
        <p className="mt-2 text-xs text-text-faint">
          Der Browser hat den Speicher nicht als „dauerhaft“ zugesagt und kann die Bilder bei Platzmangel wieder löschen.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {downloading ? (
          <Button variant="secondary" onClick={() => abort.current?.abort()}>
            Abbrechen
          </Button>
        ) : (
          <Button variant="primary" iconLeft={<DownloadCloud size={16} aria-hidden />} disabled={!catalog || complete} onClick={() => void download()}>
            {status && status.cached > 0 && !complete ? "Fehlende Bilder laden" : "Bilder für offline laden"}
          </Button>
        )}
        <Button variant="secondary" iconLeft={<RefreshCw size={16} aria-hidden className={refreshing ? "animate-spin" : undefined} />} disabled={refreshing || downloading} onClick={() => void update()}>
          Liste aktualisieren
        </Button>
        {status && status.cached > 0 && !downloading && (
          <Button variant="ghost" iconLeft={<Trash2 size={16} aria-hidden />} onClick={() => void remove()}>
            Bilder entfernen
          </Button>
        )}
      </div>
    </Card>
  );
}
