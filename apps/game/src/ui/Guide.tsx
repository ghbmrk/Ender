import { useEffect, useState, type ReactNode } from "react";
import { learn, learned } from "../game/firstUse";

export type GuideStep = { text: ReactNode; focus?: string };

/**
 * A guided first use: a few short steps, one at a time, each tap moving on. Shown until finished once, then never
 * again. `onStep` reports the step's `focus` so the screen can light the part it is about.
 */
export function Guide({ id, steps, onStep, className = "" }: { id: string; steps: GuideStep[]; onStep?: (focus: string | null) => void; className?: string }) {
  const [step, setStep] = useState(() => (learned(id) ? -1 : 0));
  useEffect(() => {
    if (step === 0) onStep?.(steps[0]?.focus ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (step < 0 || !steps.length) return null;
  const last = step >= steps.length - 1;
  const next = () => {
    if (last) {
      learn(id);
      setStep(-1);
      onStep?.(null);
      return;
    }
    setStep(step + 1);
    onStep?.(steps[step + 1]!.focus ?? null);
  };
  return (
    <button className={`guide ${className}`} onClick={next} data-testid={`guide-${id}`}>
      <span className="gl-text">{steps[step]!.text}</span>
      <span className="gl-foot">
        <span className="gl-pips">{steps.length > 1 && steps.map((_, i) => <i key={i} className={i <= step ? "on" : ""} />)}</span>
        <span className="gl-next" data-testid="guide-next">
          {last ? "Got it" : "Next ›"}
        </span>
      </span>
    </button>
  );
}
