import type { Camera } from "../render/iso";
import type { SimEvent } from "../types";
import { spatialAudioForWorld } from "./spatial";
import { playSfx } from "./synth";

export function dispatchBattlefieldAudio(
  events: SimEvent[],
  camera: Camera,
  screenWidth: number,
  screenHeight: number,
): void {
  let built = false;
  let produced = false;

  for (const event of events) {
    if (event.type === "combat") {
      const shot = spatialAudioForWorld(event.x, event.y, camera, screenWidth, screenHeight);
      if (shot.audible) {
        playSfx(event.weapon === "smallArms" ? "smallArms" : event.weapon === "antiArmor" ? "antiArmor" : "cannon", {
          pan: shot.pan,
          gain: shot.gain * (event.owner === 1 ? 0.8 : 1),
        });
      }
      if (!event.destroyed) {
        const impact = spatialAudioForWorld(event.targetX, event.targetY, camera, screenWidth, screenHeight);
        if (impact.audible) playSfx("impact", { pan: impact.pan, gain: impact.gain * 0.7 });
      }
    } else if (event.type === "destroyed") {
      const impact = spatialAudioForWorld(event.x, event.y, camera, screenWidth, screenHeight);
      if (impact.audible) playSfx("destruction", { pan: impact.pan, gain: impact.gain });
    } else if (event.type === "sold") {
      playSfx("sell", { force: true });
    } else if (event.type === "repairStarted") {
      playSfx("repair", { force: true });
    } else if (event.type === "built" && event.owner === 0) {
      built = true;
    } else if (event.type === "produced" && event.owner === 0) {
      produced = true;
    }
  }

  if (built) playSfx("buildComplete", { force: true });
  if (produced) playSfx("productionComplete", { force: true });
}
