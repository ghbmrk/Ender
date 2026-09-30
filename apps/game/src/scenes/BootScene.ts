import Phaser from "phaser";
import { makeTextures } from "../game/textures";
import { bus } from "../state/bus";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }
  create() {
    makeTextures(this);
    bus.emit("scene:ready", { scene: "boot" });
  }
}
