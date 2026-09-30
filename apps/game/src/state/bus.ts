// Tiny typed event bus between Phaser scenes and React.
type Handler<T> = (payload: T) => void;

export type BusEvents = {
  "station:open": { station: StationId };
  "run:room-cleared": { roomIndex: number };
  "run:shrine": { roomIndex: number };
  "run:ended": { outcome: "victory" | "death" | "abandon"; roomsCleared: number[]; kills: Record<string, number>; durationMs: number; bossPhaseMs: number[]; wardBreaks: number };
  "run:pickup": { kind: "crowns" | "essence" | "form" | "currency"; label: string };
  "hud:tick": HudState;
  "scene:ready": { scene: string };
};

export type StationId = "gate" | "crucible" | "mirror" | "bazaar" | "grimoire" | "passives";

export type HudState = {
  hp: number;
  maxHp: number;
  cooldowns: { bolt: number; sever: number; slip: number; unravel: number };
  cooldownMax: { bolt: number; sever: number; slip: number; unravel: number };
  room: number;
  roomKind: string;
  enemiesLeft: number;
  boss?: { hp: number; maxHp: number; ward: number; phase: number; wardTarget: number; wardRatio: number; vulnerable: boolean };
  prompt?: string;
};

class Bus {
  private handlers = new Map<string, Set<Handler<unknown>>>();
  on<K extends keyof BusEvents>(k: K, h: Handler<BusEvents[K]>) {
    if (!this.handlers.has(k)) this.handlers.set(k, new Set());
    this.handlers.get(k)!.add(h as Handler<unknown>);
    return () => this.handlers.get(k)!.delete(h as Handler<unknown>);
  }
  emit<K extends keyof BusEvents>(k: K, payload: BusEvents[K]) {
    for (const h of this.handlers.get(k) ?? []) h(payload);
  }
}
export const bus = new Bus();
