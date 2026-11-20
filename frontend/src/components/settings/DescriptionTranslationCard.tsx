import { useEffect, useRef, useState } from "react";
import { Languages } from "lucide-react";
import { getDescriptionTranslationRequest, startDescriptionTranslationRequest } from "../../api/exercise.api";
import { syncExerciseCatalog } from "../../offline/exerciseCatalog";
import { ApiError } from "../../api/client";
import { Button, Callout, Card } from "../ui";
import { useQueryClient } from "@tanstack/react-query";
import { EXERCISE_CATALOG_KEY } from "../../hooks/useExerciseLibrary";

type State = Awaited<ReturnType<typeof getDescriptionTranslationRequest>>;

// Operator only: the exercise descriptions come from an English dataset. This translates them into German,
// once, with the operator's own AI key (see "KI-Schlüssel"), and can be started again for what is left.
export function DescriptionTranslationCard() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wasRunning = useRef(false);

  const load = async () => {
    try {
      setState(await getDescriptionTranslationRequest());
    } catch {
      // not reachable: keep what is shown
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // While a run is going, look at its progress every few seconds.
  useEffect(() => {
    if (!state?.running) return;
    const id = setInterval(() => void load(), 4000);
    return () => clearInterval(id);
  }, [state?.running]);

  // When a run ends, take the new descriptions over into the local catalog.
  useEffect(() => {
    if (wasRunning.current && state && !state.running) {
      void syncExerciseCatalog(true).then(() => queryClient.invalidateQueries({ queryKey: EXERCISE_CATALOG_KEY }));
    }
    wasRunning.current = !!state?.running;
  }, [state, queryClient]);

  if (!state?.isOperator) return null;

  const start = async () => {
    setError(null);
    try {
      setState(await startDescriptionTranslationRequest());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Konnte nicht gestartet werden.");
    }
  };

  return (
    <Card title="Beschreibungen auf Deutsch">
      <p className="text-small text-text-subtle">
        Die Beschreibungen der Übungen sind noch englisch. Die KI übersetzt sie einmalig ins Deutsche, mit deinem
        eigenen Schlüssel (kostenloses Gemini-Kontingent reicht). Der Lauf kann jederzeit wiederholt werden; er
        übersetzt nur, was noch fehlt.
      </p>
      <p className="mt-2 tabular text-small text-text-2">
        {state.remaining === 0 ? "Alle Beschreibungen sind übersetzt." : `${state.remaining} Beschreibungen noch auf Englisch.`}
        {state.running || state.translated > 0 ? ` In diesem Lauf: ${state.translated} übersetzt${state.failed > 0 ? `, ${state.failed} übersprungen` : ""}.` : ""}
      </p>
      {state.error && (
        <Callout tone="warning" className="mt-3">
          {state.error}
        </Callout>
      )}
      {error && (
        <Callout tone="danger" className="mt-3">
          {error}
        </Callout>
      )}
      <div className="mt-4">
        <Button variant="primary" iconLeft={<Languages size={16} aria-hidden />} disabled={state.running || state.remaining === 0} onClick={() => void start()}>
          {state.running ? "Übersetzt…" : state.translated > 0 || state.error ? "Weiter übersetzen" : "Übersetzung starten"}
        </Button>
      </div>
    </Card>
  );
}
