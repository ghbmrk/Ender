// The E2E autopilot must never wedge itself against cover on the way to a portal or a target.
import { describe, expect, it } from "vitest";
import { waypoint } from "../../apps/game/src/combat/autopilot";

describe("autopilot waypoint", () => {
  const wall = { x: 400, y: 200, w: 80, h: 400 };
  it("walks straight when the path is clear", () => {
    expect(waypoint({ x: 100, y: 100 }, { x: 900, y: 100 }, [wall])).toEqual({ x: 900, y: 100 });
  });
  it("detours around an obstacle in the way, via a corner that is itself reachable", () => {
    const w = waypoint({ x: 100, y: 400 }, { x: 900, y: 400 }, [wall]);
    expect(w.x).toBeLessThan(wall.x);
    expect(w.y < wall.y || w.y > wall.y + wall.h).toBe(true);
  });
});
