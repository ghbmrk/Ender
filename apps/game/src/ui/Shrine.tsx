import { useState } from "react";
import { setState, toast, useStore } from "../state/store";
import { Panel } from "./Panel";
import { FormCard } from "./FormCard";
import { doAttune } from "./craftActions";

export function Shrine() {
  const forms = useStore((s) => (s as any).shrineForms as any[] | undefined) ?? [];
  const focus = useStore((s) => s.character?.focus ?? 0);
  const [list, setList] = useState<any[]>(forms);
  const [revealing, setRevealing] = useState<string | null>(null);
  const [last, setLast] = useState<any>(null);
  const attune = async (id: string) => {
    setRevealing(id);
    try {
      const out = await doAttune(id);
      setList((l) => l.map((a) => (a.id === id ? out.artifact : a)));
      setLast(out);
    } catch (e) {
      toast((e as Error).message, "loss");
    } finally {
      setTimeout(() => setRevealing(null), 900);
    }
  };
  return (
    <Panel title="The Shrine" subtitle={`Forms gathered so far. Spend Focus to Attune the promising ones. (${focus} Focus)`} wide testId="shrine">
      {list.length === 0 && <p className="dim">No Forms yet. They will fall from the Elite and the King.</p>}
      <div className="form-grid">
        {list.map((a) => (
          <div key={a.id} className={revealing === a.id ? "levitate" : ""}>
            <FormCard a={a}>
              {a.tier === "veiled" && (
                <button className="primary" disabled={focus < 1 || !!revealing} onClick={() => attune(a.id)} data-testid={`attune-${a.id}`}>
                  Attune · 1 Focus
                </button>
              )}
            </FormCard>
          </div>
        ))}
      </div>
      {last && (
        <div className="familiar-box">
          <b>
            {last.familiar.fantasyName}, {last.familiar.epithet}
          </b>
          <ul>
            {last.familiar.observations.map((o: any, i: number) => (
              <li key={i} className={o.significance}>
                {o.text}
              </li>
            ))}
          </ul>
          <div>
            The Familiar suggests: <b>{last.familiar.suggestedAction}</b>
          </div>
        </div>
      )}
      <div className="row end">
        <button onClick={() => setState({ panel: null })} data-testid="leave-shrine">
          Rise and go on
        </button>
      </div>
    </Panel>
  );
}
