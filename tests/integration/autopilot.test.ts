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
  it("does not orbit a corner at low frame rates (32px steps, the stall seen in E2E)", () => {
    const cover = { x: 1151, y: 368, w: 145, h: 100 };
    const goal = { x: 1510, y: 500 };
    const me = { x: 1101, y: 334 };
    let steps = 0;
    while (Math.hypot(goal.x - me.x, goal.y - me.y) > 40 && steps < 200) {
      const w = waypoint(me, goal, [cover]);
      const d = Math.hypot(w.x - me.x, w.y - me.y) || 1;
      me.x += ((w.x - me.x) / d) * 32;
      me.y += ((w.y - me.y) / d) * 32;
      steps++;
    }
    expect(steps).toBeLessThan(40);
  });
  it("reaches a target pressed against cover that joins another block (second E2E stall)", () => {
    const cover = [
      { x: 1159, y: 586, w: 81, h: 92 },
      { x: 1157, y: 479, w: 159, h: 105 },
    ];
    const goal = { x: 1256, y: 615 };
    const me = { x: 1129, y: 614 };
    const lineOfFire = () => waypoint(me, goal, cover, 0) === goal;
    let steps = 0;
    while (!lineOfFire() && steps < 200) {
      const w = waypoint(me, goal, cover);
      const d = Math.hypot(w.x - me.x, w.y - me.y) || 1;
      me.x += ((w.x - me.x) / d) * 32;
      me.y += ((w.y - me.y) / d) * 32;
      steps++;
    }
    expect(steps).toBeLessThan(40);
  });
});

