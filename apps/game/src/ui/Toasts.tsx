import { useEffect, useRef } from "react";
import { dismissToast, hurryToast, useStore } from "../state/store";

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const screen = useStore((s) => s.screen);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else hurryToast();
  }, [screen]);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone ?? "info"}`} onPointerDown={dismissToast}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
