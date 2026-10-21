import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { CALCULATIONS, GROUP_LABELS, type CalculationGroup } from "../../data/calculations";
import { CalculationDetails } from "../info/CalculationDetails";
import { Card } from "../ui";

const GROUP_ORDER: CalculationGroup[] = ["ernaehrung", "training", "plan", "begriffe"];

// Everything the app calculates, with formula, inputs and origin — for checking the maths
// instead of having to trust a number. Opened from the (i) buttons or by scrolling here.
export function CalculationsCard() {
  const root = useRef<HTMLDivElement>(null);

  // Arriving via "/settings#berechnungen" scrolls to this card.
  useEffect(() => {
    if (window.location.hash === "#berechnungen") root.current?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <div ref={root} id="berechnungen" className="scroll-mt-4">
      <Card title="Berechnungen & Quellen">
        <p className="text-small text-text-subtle">
          Alles, was die App rechnet: die Formel, was eingeht und woher die Methode stammt. Manches ist eine
          veröffentlichte Formel, manches ein gängiger Richtwert, manches eine eigene Annahme der App; das steht
          jeweils dabei. Alle Werte sind Schätzungen und ersetzen keine medizinische oder fachliche Beratung.
        </p>
        <div className="mt-3 flex flex-col gap-4">
          {GROUP_ORDER.map((group) => (
            <section key={group}>
              <h3 className="mb-1 text-body font-medium text-text">{GROUP_LABELS[group]}</h3>
              <div className="rounded-lg border border-border-subtle">
                {CALCULATIONS.filter((c) => c.group === group).map((info) => (
                  <details key={info.id} className="group border-t border-border-subtle first:border-t-0">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-small text-text [&::-webkit-details-marker]:hidden">
                      <span>{info.title}</span>
                      <ChevronDown size={16} aria-hidden className="shrink-0 text-text-faint transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-3 pb-3">
                      <CalculationDetails info={info} />
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Card>
    </div>
  );
}
