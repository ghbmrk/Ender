import Phaser from "phaser";
import { BootScene } from "../scenes/BootScene";
import { CrossingScene } from "../scenes/CrossingScene";
import { RealmScene, type RealmSceneData } from "../scenes/RealmScene";

let game: Phaser.Game | null = null;

export function createGame(parent: HTMLElement) {
  if (game) return game;
  game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    backgroundColor: "#0b0a10",
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth || 1280, height: parent.clientHeight || 720 },
    fps: { target: 60 },
    render: { antialias: true },
    input: { keyboard: { capture: [] } },
    scene: [BootScene, CrossingScene, RealmScene],
  });
  return game;
}

export const getGame = () => game;

export function goToCrossing() {
  if (!game) return;
  game.scene.stop("realm");
  game.scene.stop("boot");
  game.scene.start("crossing");
}

export function goToRealm(data: RealmSceneData) {
  if (!game) return;
  game.scene.stop("crossing");
  game.scene.stop("boot");
  game.scene.start("realm", data);
}
