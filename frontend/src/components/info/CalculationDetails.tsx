import { BASIS_LABELS, type CalculationInfo } from "../../data/calculations";
import { Badge } from "../ui";

const BASIS_TONE = { literatur: "accent", richtwert: "info", annahme: "warning" } as const;

// One calculation laid out for reading: where you see it, the formula step by step, the inputs,
// where the method comes from and how reliable that origin is.
export function CalculationDetails({ info }: { info: CalculationInfo }) {
  return (
    <div className="flex flex-col gap-3 text-small text-text-2">
      <div>
        <Badge tone={BASIS_TONE[info.basis]}>{BASIS_LABELS[info.basis]}</Badge>
      </div>
      <section>
        <h4 className="text-overline uppercase text-text-faint">Wo du es siehst</h4>
        <p className="mt-0.5">{info.shows}</p>
      </section>
      {info.formula.length > 0 && (
        <section>
          <h4 className="text-overline uppercase text-text-faint">Formel / Regel</h4>
          <div className="mt-1 rounded-lg bg-surface-2 p-3 font-mono text-xs leading-relaxed text-text">
            {info.formula.map((line, i) => (
              <p key={i} className={line.startsWith("  ") ? "pl-4" : i > 0 ? "mt-1.5" : undefined}>
                {line.trim()}
              </p>
            ))}
          </div>
        </section>
      )}
      {info.inputs && (
        <section>
          <h4 className="text-overline uppercase text-text-faint">Eingaben</h4>
          <p className="mt-0.5">{info.inputs}</p>
        </section>
      )}
      <section>
        <h4 className="text-overline uppercase text-text-faint">Herkunft</h4>
        <ul className="mt-0.5 flex flex-col gap-1.5">
          {info.sources.map((source, i) => (
            <li key={i}>{source}</li>
          ))}
        </ul>
      </section>
      {info.note && (
        <section>
          <h4 className="text-overline uppercase text-text-faint">Gut zu wissen</h4>
          <p className="mt-0.5">{info.note}</p>
        </section>
      )}
      {info.code && <p className="text-xs text-text-faint">Umsetzung im Code: {info.code}</p>}
    </div>
  );
}
