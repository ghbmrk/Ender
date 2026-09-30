import Phaser from "phaser";
import { bus, type StationId } from "../state/bus";
import { getState } from "../state/store";
import { debug } from "../game/debug";
import { HumanInput, PlayerBody, DEFAULT_STATS } from "../entities/player";
import { dist, type Rect } from "../combat/geometry";

const W = 1400;
const H = 900;

type Station = { id: StationId; name: string; x: number; y: number; color: number; hint: string };

const STATIONS: Station[] = [
  { id: "gate", name: "Realm Gate", x: 700, y: 150, color: 0xb58cff, hint: "Choose where to fight" },
  { id: "bazaar", name: "Bazaar", x: 1130, y: 330, color: 0xc9a24a, hint: "Prices, contracts, Prophecy" },
  { id: "crucible", name: "Crucible", x: 270, y: 330, color: 0xe8743b, hint: "Temper, Fracture, Trial" },
  { id: "mirror", name: "Mirror", x: 330, y: 680, color: 0x7fe3e0, hint: "Witness a Form" },
  { id: "grimoire", name: "Grimoire", x: 1070, y: 690, color: 0x9a948c, hint: "Lineage and evidence" },
  { id: "passives", name: "Passive Tree", x: 700, y: 760, color: 0x5fbf62, hint: "Shape your search" },
];

/** The walkable hub. Stations are places, not menu items. */
export class CrossingScene extends Phaser.Scene {
  private player!: PlayerBody;
  private input_!: HumanInput;
  private labels: Phaser.GameObjects.Text[] = [];
  private promptT!: Phaser.GameObjects.Text;
  private near: Station | null = null;
  private obstacles: Rect[] = [{ x: 640, y: 400, w: 120, h: 100 }];

  constructor() {
    super("crossing");
  }

  create() {
    this.input_ = new HumanInput(this);
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x121018, 1).fillRect(0, 0, W, H);
    // cobbles in rings around the central well
    for (let r = 80; r < 700; r += 55) g.lineStyle(1, 0x2a2533, 0.8).strokeCircle(W / 2, H / 2 + 20, r);
    g.fillStyle(0x201b2b, 1).fillRect(0, 0, W, 36).fillRect(0, H - 36, W, 36).fillRect(0, 0, 36, H).fillRect(W - 36, 0, 36, H);
    // the well (an obstacle)
    g.fillStyle(0x1b1624, 1).fillRect(640, 400, 120, 100);
    g.lineStyle(3, 0xc9a24a, 0.6).strokeRect(640, 400, 120, 100);
    g.lineStyle(2, 0xb58cff, 0.5).strokeCircle(700, 450, 30);
    this.add.text(700, 520, "THE CROSSING", { fontFamily: "Georgia, serif", fontSize: "14px", color: "#8f8699", letterSpacing: 4 } as any).setOrigin(0.5);

    for (const s of STATIONS) {
      const img = this.add.image(s.x, s.y, "station").setTint(s.color).setDepth(2);
      this.tweens.add({ targets: img, angle: 360, duration: 24000, repeat: -1 });
      this.add.circle(s.x, s.y, 14, s.color, 0.9).setDepth(3);
      this.labels.push(
        this.add.text(s.x, s.y + 64, s.name, { fontFamily: "Georgia, serif", fontSize: "18px", color: "#e8d9a8", stroke: "#000", strokeThickness: 4 }).setOrigin(0.5).setDepth(4),
      );
    }
    this.promptT = this.add.text(0, 0, "", { fontFamily: "Georgia, serif", fontSize: "15px", color: "#ffffff", backgroundColor: "#000000aa", padding: { x: 8, y: 4 } }).setOrigin(0.5).setDepth(20);

    this.player = new PlayerBody(this, W / 2, H / 2 + 150, DEFAULT_STATS);
    this.cameras.main.setBounds(0, 0, W, H).startFollow(this.player.sprite, true, 0.12, 0.12).setBackgroundColor(0x0b0a10);
    bus.emit("scene:ready", { scene: "crossing" });
    (window as any).__weave.crossing = this;
  }

  override update(_t: number, dms: number) {
    const dt = Math.min(0.05, dms / 1000) * debug.timeScale;
    const uiOpen = getState().panel !== null;
    const intent = this.input_.read(this.player.x, this.player.y, !uiOpen);
    this.player.move(dt, intent, { x: 36, y: 36, w: W - 72, h: H - 72 }, this.obstacles);
    this.near = null;
    for (const s of STATIONS) if (dist(this.player, s) < 95) this.near = s;
    if (this.near && !uiOpen) {
      this.promptT.setText(`E — ${this.near.name} · ${this.near.hint}`).setPosition(this.near.x, this.near.y - 80).setVisible(true);
      if (intent.interact) bus.emit("station:open", { station: this.near.id });
    } else this.promptT.setVisible(false);
  }

  /** Test hook: walk-free station access. */
  teleportTo(id: StationId) {
    const s = STATIONS.find((x) => x.id === id)!;
    this.player.x = s.x;
    this.player.y = s.y + 40;
  }
}
