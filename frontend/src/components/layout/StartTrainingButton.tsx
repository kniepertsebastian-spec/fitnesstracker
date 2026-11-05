import { Dumbbell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOpenWorkoutSession, useStartWorkoutSession } from "../../hooks/useWorkoutSession";
import { Button } from "../ui";
import type { ButtonProps } from "../ui";

// "Training starten" / "Training fortsetzen" — starts a session (offline-capable, see
// offline/workoutSessionSync.ts) when none is open, then opens the focus mode.
export function StartTrainingButton({ onNavigate, ...props }: ButtonProps & { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { data: session } = useOpenWorkoutSession();
  const start = useStartWorkoutSession();

  const handleClick = () => {
    onNavigate?.();
    if (session) {
      navigate("/training");
      return;
    }
    start.mutate(crypto.randomUUID(), { onSuccess: () => navigate("/training") });
  };

  return (
    <Button
      variant="primary"
      iconLeft={<Dumbbell size={18} strokeWidth={2} aria-hidden />}
      disabled={start.isPending}
      onClick={handleClick}
      {...props}
    >
      {session ? "Training fortsetzen" : "Training starten"}
    </Button>
  );
}
