import Phaser from "phaser";
import { ENEMIES, ESSENCES, realmById, type EnemyKind } from "@weave/content";
import { bus } from "../state/bus";
import { debug } from "../game/debug";
import { getState } from "../state/store";
import { HumanInput, PlayerBody, type Intent, type PlayerStats } from "../entities/player";
import { Enemy, updateEnemy, type EnemyWorld } from "../entities/enemies";
import { BoundKing, type BossWorld } from "../entities/boss";
import { angleDiff, angleTo, dist, pointInRect, type Rect } from "../combat/geometry";
import { autopilot } from "../combat/autopilot";

type Projectile = { s: Phaser.GameObjects.Image; x: number; y: number; vx: number; vy: number; r: number; dmg: number; life: number; owner: "player" | "enemy"; hit: Set<number> };
type Telegraph = { x: number; y: number; r: number; t: number; total: number; dmg: number; color: number };
type Pickup = { s: Phaser.GameObjects.Image; x: number; y: number; kind: "crowns" | "essence" | "form" | "currency"; label: string; t: number; color?: number };

export type RealmSceneData = { plan: any; stats: PlayerStats };

const W = 1600;
const H = 1000;
const WALL = 40;

export class RealmScene extends Phaser.Scene {
  private plan: any;
  private stats!: PlayerStats;
  private realm!: ReturnType<typeof realmById>;
  private player!: PlayerBody;
  private input_!: HumanInput;
  private enemies: Enemy[] = [];
  private boss: BoundKing | null = null;
  private projectiles: Projectile[] = [];
  private telegraphs: Telegraph[] = [];
  private pickups: Pickup[] = [];
  private obstacles: Rect[] = [];
  private roomObjects: Phaser.GameObjects.GameObject[] = [];
  private fx!: Phaser.GameObjects.Graphics;
  private roomIndex = 0;
  private waveIndex = 0;
  private roomCleared = false;
  private portal: Phaser.GameObjects.Image | null = null;
  private shrine: Phaser.GameObjects.Image | null = null;
  private cleared: number[] = [];
  private kills: Record<string, number> = {};
  private startedAt = 0;
  private ended = false;
  private hudT = 0;
  private sweep: { a: number; t: number } | null = null;
  private burst: { t: number; r: number } | null = null;
  private prompt: string | undefined;
  private transitioning = false;
  private particles!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super("realm");
  }

  init(data: RealmSceneData) {
    this.plan = data.plan;
    this.stats = data.stats;
    this.realm = realmById(data.plan.realmId);
    this.enemies = [];
    this.projectiles = [];
    this.telegraphs = [];
    this.pickups = [];
    this.boss = null;
    this.roomIndex = 0;
    this.cleared = [];
    this.kills = {};
    this.ended = false;
    this.finished = false;
    this.shrineVisited = false;
    this.transitioning = false;
  }

  create() {
    this.startedAt = performance.now();
    this.input_ = new HumanInput(this);
    this.cameras.main.setBounds(0, 0, W, H).setBackgroundColor(this.realm.palette.fog);
    this.player = new PlayerBody(this, 140, H / 2, this.stats);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
    const fitZoom = () => this.cameras.main.setZoom(Phaser.Math.Clamp(this.scale.width / 1200, 1, 1.4));
    fitZoom();
    this.scale.on("resize", fitZoom);
    this.events.once("shutdown", () => this.scale.off("resize", fitZoom));
    this.fx = this.add.graphics().setDepth(6);
    this.particles = this.add.particles(0, 0, "spark", {
      lifespan: 380,
      speed: { min: 60, max: 260 },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    });
    this.particles.setDepth(12);
    this.enterRoom(0);
    bus.emit("scene:ready", { scene: "realm" });
    (window as any).__weave.realm = this;
  }

  // ───────────────────────── rooms ─────────────────────────

  private enterRoom(i: number) {
    for (const o of this.roomObjects) o.destroy();
    this.roomObjects = [];
    for (const e of this.enemies) e.destroy();
    this.enemies = [];
    for (const p of this.projectiles) p.s.destroy();
    this.projectiles = [];
    for (const p of this.pickups) p.s.destroy();
    this.pickups = [];
    this.telegraphs = [];
    this.portal = null;
    this.shrine = null;
    this.roomIndex = i;
    this.waveIndex = 0;
    this.roomCleared = false;
    const room = this.plan.rooms[i];
    const pal = this.realm.palette;

    const floor = this.add.graphics().setDepth(0);
    floor.fillStyle(pal.floor, 1).fillRect(0, 0, W, H);
    // flagstones
    floor.lineStyle(1, pal.wall, 0.35);
    for (let x = WALL; x < W; x += 80) floor.lineBetween(x, WALL, x, H - WALL);
    for (let y = WALL; y < H; y += 80) floor.lineBetween(WALL, y, W - WALL, y);
    floor.fillStyle(pal.wall, 1).fillRect(0, 0, W, WALL).fillRect(0, H - WALL, W, WALL).fillRect(0, 0, WALL, H).fillRect(W - WALL, 0, WALL, H);
    floor.lineStyle(2, pal.accent, 0.35).strokeRect(WALL, WALL, W - 2 * WALL, H - 2 * WALL);
    this.roomObjects.push(floor);
    this.obstacles = room.obstacles as Rect[];
    const obs = this.add.graphics().setDepth(5);
    for (const o of this.obstacles) {
      obs.fillStyle(0x000000, 0.35).fillRect(o.x + 6, o.y + 8, o.w, o.h);
      obs.fillStyle(pal.wall, 1).fillRect(o.x, o.y, o.w, o.h);
      obs.lineStyle(2, pal.accent, 0.4).strokeRect(o.x, o.y, o.w, o.h);
    }
    this.roomObjects.push(obs);

    this.player.x = 140;
    this.player.y = H / 2;
    this.player.sprite.setPosition(this.player.x, this.player.y);
    this.cameras.main.centerOn(this.player.x, this.player.y);

    const label = room.kind === "boss" ? "The Bound King" : room.kind === "elite" ? "An Elite stirs" : room.kind === "shrine" ? "A quiet shrine" : `${this.realm.name} · ${i + 1}/5`;
    this.announce(label);

    if (room.kind === "shrine") {
      this.shrine = this.add.image(W / 2, H / 2, "shrine").setDepth(4);
      this.roomObjects.push(this.shrine);
      this.tweens.add({ targets: this.shrine, alpha: { from: 0.7, to: 1 }, yoyo: true, repeat: -1, duration: 1400 });
      this.onRoomCleared();
    } else if (room.kind === "boss") {
      this.time.delayedCall(900, () => {
        this.boss = new BoundKing(this, W - 380, H / 2, this.plan.boss.hp, this.plan.boss.wardTargets, this.stats.wardPower, this.stats.wardMultiplier);
      });
    } else {
      this.time.delayedCall(500, () => this.spawnWave());
    }
  }

  private spawnWave() {
    const room = this.plan.rooms[this.roomIndex];
    const wave = room.waves[this.waveIndex] ?? [];
    for (const e of wave) {
      const en = new Enemy(this, e.kind as EnemyKind, e.x, e.y, this.plan.difficulty, e.elite);
      this.enemies.push(en);
      this.fx.lineStyle(2, 0xffffff, 0.5).strokeCircle(e.x, e.y, en.r + 8);
    }
  }

  private onRoomCleared() {
    if (this.roomCleared) return;
    this.roomCleared = true;
    const room = this.plan.rooms[this.roomIndex];
    if (!this.cleared.includes(this.roomIndex)) this.cleared.push(this.roomIndex);
    bus.emit("run:room-cleared", { roomIndex: this.roomIndex });
    if (room.kind !== "shrine") this.dropLoot(room.loot, this.lastKillPos ?? { x: W / 2, y: H / 2 });
    if (room.kind === "boss") {
      this.announce("The Bound King is unbound");
      this.time.delayedCall(2600, () => this.finish("victory"));
      return;
    }
    this.portal = this.add.image(W - 90, H / 2, "portal").setDepth(3).setAlpha(0);
    this.tweens.add({ targets: this.portal, alpha: 1, duration: 500 });
    this.roomObjects.push(this.portal);
  }

  private lastKillPos: { x: number; y: number } | null = null;

  private dropLoot(loot: any, at: { x: number; y: number }) {
    const spray = (kind: Pickup["kind"], tex: string, label: string, color?: number) => {
      const a = Math.random() * Math.PI * 2;
      const r = 20 + Math.random() * 70;
      const x = Phaser.Math.Clamp(at.x + Math.cos(a) * r, WALL + 20, W - WALL - 20);
      const y = Phaser.Math.Clamp(at.y + Math.sin(a) * r, WALL + 20, H - WALL - 20);
      const s = this.add.image(at.x, at.y, tex).setDepth(4);
      if (color !== undefined) s.setTint(color);
      this.tweens.add({ targets: s, x, y, duration: 350, ease: "Quad.Out" });
      this.pickups.push({ s, x, y, kind, label, t: 0.45, color });
    };
    const coins = Math.min(8, Math.ceil(loot.crowns / 6));
    for (let i = 0; i < coins; i++) spray("crowns", "coin", i === 0 ? `+${loot.crowns} Crowns` : "");
    for (const [e, q] of Object.entries(loot.essences ?? {})) {
      const def = ESSENCES[e as keyof typeof ESSENCES];
      for (let i = 0; i < (q as number); i++) spray("essence", "mote", i === 0 ? `+${q} ${def.name}` : "", Phaser.Display.Color.HexStringToColor(def.color).color);
    }
    for (let i = 0; i < loot.veiledForms; i++) spray("form", "form", "A Veiled Form");
    if (loot.currency) spray("currency", "form", "A strange token", 0xc9a24a);
  }

  private announce(text: string) {
    const cam = this.cameras.main;
    const t = this.add
      .text(cam.worldView.centerX || W / 2, (cam.worldView.y || 0) + 120, text, { fontFamily: "Georgia, serif", fontSize: "30px", color: "#e8d9a8", stroke: "#000", strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(50)
      .setScrollFactor(0)
      .setPosition(cam.width / 2, 90)
      .setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 300, yoyo: true, hold: 1400, onComplete: () => t.destroy() });
  }

  // ───────────────────────── combat helpers ─────────────────────────

  private damageRoll(mult: number) {
    const crit = Math.random() < this.stats.critChance;
    return { dmg: this.stats.attackDamage * mult * (crit ? this.stats.critMultiplier : 1) * debug.damageScale, crit };
  }

  private floatText(x: number, y: number, text: string, color: string, size = 16) {
    const t = this.add.text(x, y, text, { fontFamily: "Georgia, serif", fontSize: `${size}px`, color, stroke: "#000", strokeThickness: 3 }).setOrigin(0.5).setDepth(40);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 650, onComplete: () => t.destroy() });
  }

  private damageEnemy(e: Enemy, dmg: number, crit: boolean, kx = 0, ky = 0) {
    const dealt = e.hit(dmg, kx, ky);
    this.floatText(e.x, e.y - e.r, `${Math.round(dealt)}`, crit ? "#ffd166" : "#ffffff", crit ? 20 : 15);
    this.particles.explode(4, e.x, e.y);
    if (e.hp <= 0 && e.alive) this.killEnemy(e);
  }

  private damageBoss(dmg: number, crit: boolean) {
    if (!this.boss) return;
    const wasUp = this.boss.wardUp;
    const dealt = this.boss.hit(dmg);
    this.floatText(this.boss.x, this.boss.y - 60, `${Math.round(dealt)}`, !this.boss.wardUp ? "#ff7070" : crit ? "#ffd166" : "#c9b8ff", 15);
    if (wasUp && !this.boss.wardUp) {
      this.cameras.main.shake(200, 0.006);
      this.announce("Ward broken!");
    }
    if (this.boss.hp <= 0 && this.boss.alive) {
      this.boss.alive = false;
      this.lastKillPos = { x: this.boss.x, y: this.boss.y };
      this.kills["boss"] = 1;
      this.particles.explode(60, this.boss.x, this.boss.y);
      this.cameras.main.shake(500, 0.012);
      this.tweens.add({ targets: this.boss.sprite, alpha: 0, scale: 1.6, duration: 900 });
      for (const e of this.enemies) this.killEnemy(e, true);
      this.onRoomCleared();
    }
  }

  private killEnemy(e: Enemy, silent = false) {
    if (!e.alive) return;
    e.alive = false;
    this.lastKillPos = { x: e.x, y: e.y };
    this.kills[e.kind] = (this.kills[e.kind] ?? 0) + 1;
    if (!silent) this.particles.explode(e.elite ? 30 : 10, e.x, e.y);
    if (e.elite === "volatile") this.addTelegraph(e.x, e.y, 130, 0.8, e.dmg * 1.2, 0xff8a3c);
    this.tweens.add({ targets: e.sprite, alpha: 0, scale: 0.4, duration: 200, onComplete: () => e.destroy() });
    e.bar.clear();
  }

  private hurtPlayer(dmg: number) {
    if (this.player.invuln > 0 || this.ended) return;
    const d = dmg * (1 - Math.min(0.5, this.stats.armor / 100));
    if (!debug.godMode) this.player.hp -= d;
    this.player.invuln = 0.35;
    this.player.hurtFlash = 0.15;
    this.cameras.main.shake(90, 0.004);
    this.floatText(this.player.x, this.player.y - 26, `-${Math.round(d)}`, "#ff6b6b", 16);
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.announce("Your thread is cut");
      this.time.timeScale = 0.4;
      this.time.delayedCall(700, () => this.finish("death"));
      this.ended = true;
    }
  }

  private addTelegraph(x: number, y: number, r: number, delay: number, dmg: number, color = 0xff4b4b) {
    this.telegraphs.push({ x, y, r, t: delay, total: delay, dmg, color });
  }

  private shoot(x: number, y: number, a: number, speed: number, dmg: number, owner: "player" | "enemy") {
    const s = this.add.image(x, y, owner === "player" ? "bolt" : "ebolt").setDepth(9);
    this.projectiles.push({ s, x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: owner === "player" ? 7 : 7, dmg, life: owner === "player" ? 0.9 : 3.5, owner, hit: new Set() });
  }

  // ───────────────────────── abilities ─────────────────────────

  private useAbilities(intent: Intent) {
    const p = this.player;
    const a = Math.atan2(intent.aimY, intent.aimX);
    if (intent.fire && p.cd.bolt <= 0) {
      const { dmg, crit } = this.damageRoll(1);
      this.shoot(p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18, a, this.stats.projectileSpeed, dmg, "player");
      this.projectiles[this.projectiles.length - 1]!.s.setData("crit", crit);
      p.cd.bolt = p.cooldown("bolt");
    }
    if (intent.sever && p.cd.sever <= 0) {
      p.cd.sever = p.cooldown("sever");
      this.sweep = { a, t: 0.14 };
      const range = 125 * this.stats.areaMultiplier;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (dist(p, e) < range + e.r && angleDiff(angleTo(p, e), a) < 0.9) {
          const { dmg, crit } = this.damageRoll(1.9);
          this.damageEnemy(e, dmg, crit, Math.cos(a) * 420, Math.sin(a) * 420);
        }
      }
      if (this.boss?.alive && dist(p, this.boss) < range + this.boss.r && angleDiff(angleTo(p, this.boss), a) < 0.9) {
        const { dmg, crit } = this.damageRoll(1.9);
        this.damageBoss(dmg, crit);
      }
      // Sever also cuts enemy projectiles.
      for (const pr of this.projectiles) if (pr.owner === "enemy" && dist(p, pr) < range && angleDiff(angleTo(p, pr), a) < 0.9) pr.life = 0;
    }
    if (intent.unravel && p.cd.unravel <= 0) {
      p.cd.unravel = p.cooldown("unravel");
      const r = 175 * this.stats.areaMultiplier;
      this.burst = { t: 0.3, r };
      this.cameras.main.shake(120, 0.005);
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (dist(p, e) < r + e.r) {
          const ang = angleTo(p, e);
          const { dmg, crit } = this.damageRoll(3);
          this.damageEnemy(e, dmg, crit, Math.cos(ang) * 600, Math.sin(ang) * 600);
        }
      }
      if (this.boss?.alive && dist(p, this.boss) < r + this.boss.r) {
        const { dmg, crit } = this.damageRoll(3);
        this.damageBoss(dmg, crit);
      }
    }
  }

  // ───────────────────────── frame ─────────────────────────

  override update(_time: number, deltaMs: number) {
    const dt = Math.min(0.05, deltaMs / 1000) * debug.timeScale * this.time.timeScale;
    const uiOpen = getState().panel !== null;
    const human = this.input_.read(this.player.x, this.player.y, !uiOpen && !this.ended);
    const intent =
      debug.autoplay && !uiOpen && !this.ended
        ? autopilot(
            this.player,
            [...this.enemies.filter((e) => e.alive && e.state !== "spawn"), ...(this.boss?.alive && this.boss.transitionT <= 0 ? [this.boss] : [])],
            this.telegraphs.map((t) => ({ x: t.x, y: t.y, r: t.r })),
            this.roomCleared ? (this.pickups.length ? this.pickups[0]! : this.portal ? { x: this.portal.x, y: this.portal.y } : this.shrine ? { x: this.shrine.x, y: this.shrine.y } : null) : null,
            this.player.cd,
          )
        : human;
    if (debug.autoplay && this.shrine && dist(this.player, this.shrine) < 110 && !this.shrineVisited) intent.interact = true;

    const bounds = { x: WALL, y: WALL, w: W - 2 * WALL, h: H - 2 * WALL };
    this.player.move(dt, intent, bounds, this.obstacles);
    if (!this.ended && !uiOpen) this.useAbilities(intent);

    // enemies
    const ew: EnemyWorld = {
      player: this.player,
      obstacles: this.obstacles,
      bounds,
      shoot: (from, a, speed, dmg) => this.shoot(from.x, from.y, a, speed, dmg, "enemy"),
      telegraph: (x, y, r, delay, dmg, color) => this.addTelegraph(x, y, r, delay, dmg, color),
      melee: (from, range, dmg) => {
        if (dist(from, this.player) < range + this.player.r) this.hurtPlayer(dmg);
      },
    };
    for (const e of this.enemies) if (e.alive) updateEnemy(e, dt, ew);
    // light separation so packs don't stack
    for (let i = 0; i < this.enemies.length; i++) {
      const a = this.enemies[i]!;
      if (!a.alive) continue;
      for (let j = i + 1; j < this.enemies.length; j++) {
        const b = this.enemies[j]!;
        if (!b.alive) continue;
        const d = dist(a, b);
        const min = a.r + b.r;
        if (d > 0 && d < min) {
          const push = (min - d) / 2;
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.alive || e.sprite.active);

    if (this.boss) {
      const bw: BossWorld = {
        player: this.player,
        obstacles: this.obstacles,
        bounds,
        bullet: (x, y, a, speed, dmg) => this.shoot(x, y, a, speed, dmg, "enemy"),
        telegraph: (x, y, r, delay, dmg, color) => this.addTelegraph(x, y, r, delay, dmg, color),
        contact: (dmg) => this.hurtPlayer(dmg),
        summon: (kinds) => {
          for (const k of kinds) {
            const a = Math.random() * Math.PI * 2;
            this.enemies.push(new Enemy(this, k as EnemyKind, this.boss!.x + Math.cos(a) * 160, this.boss!.y + Math.sin(a) * 160, this.plan.difficulty));
          }
        },
        announce: (t) => this.announce(t),
      };
      this.boss.update(dt, bw);
    }

    // projectiles
    for (const pr of this.projectiles) {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      pr.s.setPosition(pr.x, pr.y);
      if (pr.x < WALL || pr.y < WALL || pr.x > W - WALL || pr.y > H - WALL || this.obstacles.some((o) => pointInRect(pr.x, pr.y, o))) pr.life = 0;
      if (pr.life <= 0) continue;
      if (pr.owner === "player") {
        for (const e of this.enemies) {
          if (!e.alive || pr.hit.has(e.id)) continue;
          if (dist(pr, e) < e.r + pr.r) {
            pr.hit.add(e.id);
            this.damageEnemy(e, pr.dmg, !!pr.s.getData("crit"), pr.vx * 0.12, pr.vy * 0.12);
            pr.life = 0;
            break;
          }
        }
        if (pr.life > 0 && this.boss?.alive && dist(pr, this.boss) < this.boss.r + pr.r) {
          this.damageBoss(pr.dmg, !!pr.s.getData("crit"));
          pr.life = 0;
        }
      } else if (dist(pr, this.player) < this.player.r + pr.r - 2) {
        this.hurtPlayer(pr.dmg);
        pr.life = 0;
      }
    }
    for (const pr of this.projectiles) if (pr.life <= 0) pr.s.destroy();
    this.projectiles = this.projectiles.filter((p) => p.life > 0);

    // telegraphs
    for (const t of this.telegraphs) {
      t.t -= dt;
      if (t.t <= 0) {
        if (dist(t, this.player) < t.r + this.player.r * 0.5) this.hurtPlayer(t.dmg);
        this.particles.explode(14, t.x, t.y);
      }
    }
    this.telegraphs = this.telegraphs.filter((t) => t.t > 0);

    // wave / room progression
    const room = this.plan.rooms[this.roomIndex];
    if (!this.roomCleared && room.kind !== "boss" && room.kind !== "shrine" && this.enemies.every((e) => !e.alive)) {
      if (this.waveIndex + 1 < room.waves.length) {
        this.waveIndex++;
        this.spawnWave();
      } else if (this.enemies.length === 0 || this.enemies.every((e) => !e.alive)) this.onRoomCleared();
    }

    // pickups: magnet after a short delay
    for (const pk of this.pickups) {
      pk.t -= dt;
      if (pk.t > 0) continue;
      const d = dist(pk, this.player);
      const pull = Math.max(420, 1400 - d);
      const a = angleTo(pk, this.player);
      if (this.roomCleared || d < 160) {
        const step = Math.min(d, pull * dt); // never overshoot (low FPS or time scale would orbit the player)
        pk.x += Math.cos(a) * step;
        pk.y += Math.sin(a) * step;
        pk.s.setPosition(pk.x, pk.y);
      }
      if (d < 22) {
        pk.t = -99;
        pk.s.destroy();
        if (pk.label) {
          this.floatText(this.player.x, this.player.y - 40, pk.label, pk.kind === "form" ? "#d9c4ff" : pk.kind === "crowns" ? "#ffd166" : "#bff7f5", 15);
          bus.emit("run:pickup", { kind: pk.kind, label: pk.label });
        }
      }
    }
    this.pickups = this.pickups.filter((p) => p.t > -99);

    // interactions
    this.prompt = undefined;
    if (this.shrine && dist(this.player, this.shrine) < 110) {
      this.prompt = "E — Commune at the shrine";
      if (intent.interact && !uiOpen) {
        this.shrineVisited = true;
        bus.emit("run:shrine", { roomIndex: this.roomIndex });
      }
    }
    if (this.portal && !this.transitioning && this.pickups.length === 0 && dist(this.player, this.portal) < 60) {
      this.transitioning = true;
      this.cameras.main.fadeOut(220, 0, 0, 0);
      this.time.delayedCall(240, () => {
        this.enterRoom(this.roomIndex + 1);
        this.shrineVisited = false;
        this.cameras.main.fadeIn(260, 0, 0, 0);
        this.transitioning = false;
      });
    }

    this.drawFx(dt);
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.1;
      this.emitHud();
    }
  }

  private shrineVisited = false;

  private drawFx(dt: number) {
    const g = this.fx;
    g.clear();
    for (const t of this.telegraphs) {
      const k = 1 - t.t / t.total;
      g.fillStyle(t.color, 0.12 + 0.18 * k).fillCircle(t.x, t.y, t.r);
      g.lineStyle(2, t.color, 0.8).strokeCircle(t.x, t.y, t.r);
      g.fillStyle(t.color, 0.35).fillCircle(t.x, t.y, t.r * k);
    }
    const p = this.player;
    if (this.sweep) {
      this.sweep.t -= dt;
      const r = 125 * this.stats.areaMultiplier;
      g.fillStyle(0xe8d9a8, 0.35 * (this.sweep.t / 0.14)).slice(p.x, p.y, r, this.sweep.a - 0.9, this.sweep.a + 0.9, false).fillPath();
      if (this.sweep.t <= 0) this.sweep = null;
    }
    if (this.burst) {
      this.burst.t -= dt;
      const k = 1 - this.burst.t / 0.3;
      g.lineStyle(6 * (1 - k) + 1, 0xb58cff, 1 - k).strokeCircle(p.x, p.y, this.burst.r * (0.4 + 0.6 * k));
      if (this.burst.t <= 0) this.burst = null;
    }
    // aim thread
    g.lineStyle(1, 0xc9a24a, 0.25).lineBetween(p.x, p.y, p.x + Math.cos(p.facing) * 60, p.y + Math.sin(p.facing) * 60);
  }

  private emitHud() {
    const p = this.player;
    const room = this.plan.rooms[this.roomIndex];
    bus.emit("hud:tick", {
      hp: Math.max(0, Math.round(p.hp)),
      maxHp: Math.round(this.stats.maxHealth),
      cooldowns: { ...p.cd },
      cooldownMax: { bolt: p.cooldown("bolt"), sever: p.cooldown("sever"), slip: p.cooldown("slip"), unravel: p.cooldown("unravel") },
      room: this.roomIndex,
      roomKind: room.kind,
      enemiesLeft: this.enemies.filter((e) => e.alive).length,
      boss: this.boss
        ? {
            hp: Math.max(0, Math.round(this.boss.hp)),
            maxHp: this.boss.maxHp,
            ward: Math.round(this.boss.ward),
            phase: this.boss.phase,
            wardTarget: this.boss.wardTarget,
            wardRatio: Math.round(this.boss.wardRatio * 100) / 100,
            vulnerable: !this.boss.wardUp,
          }
        : undefined,
      prompt: this.prompt,
    });
  }

  private finish(outcome: "victory" | "death" | "abandon") {
    if (this.finished) return;
    this.finished = true;
    this.ended = true;
    this.time.timeScale = 1;
    bus.emit("run:ended", {
      outcome,
      roomsCleared: [...this.cleared].sort((a, b) => a - b),
      kills: this.kills,
      durationMs: Math.round(performance.now() - this.startedAt),
      bossPhaseMs: this.boss ? this.boss.phaseStartedAt.map((t, i, arr) => Math.round((arr[i + 1] ?? performance.now()) - t)) : [],
      wardBreaks: this.boss?.wardBreaks ?? 0,
    });
  }
  private finished = false;

  /** Developer/test hooks. */
  debugKillAll() {
    for (const e of this.enemies) if (e.alive) this.killEnemy(e);
    if (this.boss?.alive) {
      this.boss.transitionT = 0;
      this.boss.hp = 0;
      this.damageBoss(0, false);
    }
  }
  abandon() {
    this.finish("abandon");
  }
  get currentRoom() {
    return this.roomIndex;
  }
  enemyNames() {
    return this.enemies.filter((e) => e.alive).map((e) => ENEMIES[e.kind].name);
  }
}
