import {
  ENERGY_DRAIN_RUN,
  ENERGY_RECOVER_IDLE,
  ENERGY_RECOVER_WALK,
  ENERGY_SPRINT_RESUME,
} from "./constants";
import type { PlayerGait } from "./playerModel";

export type NeedsState = {
  energy: number;
  thirst: number;
  hunger: number;
  temperature: number;
  health: number;
};

export class Needs {
  energy = 1;
  thirst = 0.5;
  hunger = 0.5;
  temperature = 0.5;
  health = 0.5;
  canSprint = true;

  snapshot(): NeedsState {
    return {
      energy: this.energy,
      thirst: this.thirst,
      hunger: this.hunger,
      temperature: this.temperature,
      health: this.health,
    };
  }

  tick(gait: PlayerGait, dt: number): void {
    if (gait === "run") this.energy -= ENERGY_DRAIN_RUN * dt;
    else if (gait === "walk") this.energy += ENERGY_RECOVER_WALK * dt;
    else this.energy += ENERGY_RECOVER_IDLE * dt;

    this.energy = Math.min(1, Math.max(0, this.energy));
    if (this.energy <= 0) this.canSprint = false;
    else if (this.energy >= ENERGY_SPRINT_RESUME) this.canSprint = true;
  }
}
