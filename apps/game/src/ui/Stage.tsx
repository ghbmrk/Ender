import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Logical portrait canvas (§2 overridden: portrait, not landscape). Everything on the stage is laid out in these px. */
export const STAGE_W = 1080;
export const STAGE_H = 1920;

type StageCtx = { scale: number; h: number; toStage: (clientX: number, clientY: number) => { x: number; y: number } };
const Ctx = createContext<StageCtx>({ scale: 1, h: STAGE_H, toStage: (x, y) => ({ x, y }) });
/** The tallest stage we use; taller screens letterbox. */
const MAX_H = 2340;
export const useStage = () => useContext(Ctx);

/**
 * Scales the 1080-wide stage to the viewport. Tall phones get a taller stage (up to 2340) instead of letterboxing:
 * scenes pin their chrome to the top and bottom and centre the painted world (see useWorldTop).
 */
export function Stage({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [h, setH] = useState(STAGE_H);
  useLayoutEffect(() => {
    const fit = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const want = Math.max(STAGE_H, Math.min(MAX_H, Math.round((STAGE_W * vh) / vw)));
      setH(want);
      setScale(Math.min(vw / STAGE_W, vh / want));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  const toStage = (cx: number, cy: number) => {
    const r = box.current!.getBoundingClientRect();
    return { x: (cx - r.left) / scale, y: (cy - r.top) / scale };
  };
  return (
    <Ctx.Provider value={{ scale, h, toStage }}>
      <div className="stage-frame">
        <div ref={box} className="stage" style={{ width: STAGE_W, height: h, ["--stage-h" as string]: `${h}px`, transform: `translate(-50%, -50%) scale(${scale})` }}>
          {children}
        </div>
      </div>
    </Ctx.Provider>
  );
}

/** Where a 1920-tall painted world sits on a taller stage: centred in the extra height. */
export function useWorldTop() {
  const { h } = useStage();
  return Math.round((h - STAGE_H) / 2);
}
