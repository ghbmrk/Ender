import type { CSSProperties } from "react";
import "../coach.css";

/** A short, non-blocking tip from the prologue. `**bold**` marks the word to act on. */
export function Coach({ text, style, action }: { text: string; style?: CSSProperties; action?: { label: string; onClick: () => void; testId?: string } }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <div className="coach" style={style} data-testid="coach">
      <span className="coach-mark">✦</span>
      <span className="coach-text">{parts.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p))}</span>
      {action && (
        <button className="coach-go" onPointerDown={(e) => e.stopPropagation()} onClick={action.onClick} data-testid={action.testId}>
          {action.label}
        </button>
      )}
    </div>
  );
}
