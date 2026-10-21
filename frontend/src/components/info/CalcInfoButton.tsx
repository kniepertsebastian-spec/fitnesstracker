import { useState } from "react";
import { Info } from "lucide-react";
import { Link } from "react-router-dom";
import { getCalculation } from "../../data/calculations";
import { Dialog, IconButton, cn } from "../ui";
import { CalculationDetails } from "./CalculationDetails";

// Small (i) next to a calculated figure: opens how it is calculated and where the method comes
// from (the entry with this id in data/calculations.ts).
export function CalcInfoButton({ id, className }: { id: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const info = getCalculation(id);
  if (!info) return null;

  return (
    <>
      <IconButton
        aria-label={`Info zur Berechnung: ${info.title}`}
        title="Wie wird das berechnet?"
        className={cn("h-8 w-8 border-transparent bg-transparent", className)}
        onClick={() => setOpen(true)}
      >
        <Info size={16} aria-hidden />
      </IconButton>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={info.title}
        footer={
          <Link to="/settings#berechnungen" className="text-small text-accent hover:text-accent-hover" onClick={() => setOpen(false)}>
            Alle Berechnungen in den Einstellungen
          </Link>
        }
      >
        <CalculationDetails info={info} />
      </Dialog>
    </>
  );
}
