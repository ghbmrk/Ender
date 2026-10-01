import { useEffect, useRef } from "react";
import { dismissToast, hurryToast, useStore } from "../state/store";

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const screen = useStore((s) => s.screen);
  const panel = useStore((s) => s.panel);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) first.current = false;
    else hurryToast();
  }, [screen]);
  // A panel opening covers the screen the notice was about, so the notice makes way for its header.
  useEffect(() => {
    if (panel) hurryToast(600);
  }, [panel]);
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
