import type { ReactNode } from "react";
import { setState } from "../state/store";

export function Panel({ title, subtitle, children, wide, onClose, testId }: { title: string; subtitle?: ReactNode; children: ReactNode; wide?: boolean; onClose?: () => void; testId?: string }) {
  const close = onClose ?? (() => setState({ panel: null }));
  return (
    <div className="panel-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className={`panel ${wide ? "wide" : ""}`} data-testid={testId}>
        <header className="panel-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <div className="sub">{subtitle}</div>}
          </div>
          <button className="ghost close" onClick={close} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="panel-body">{children}</div>
      </div>
    </div>
  );
}
