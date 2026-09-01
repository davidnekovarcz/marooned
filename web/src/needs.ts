import {
  ENERGY_DRAIN_RUN,
  ENERGY_RECOVER_IDLE,
  ENERGY_RECOVER_WALK,
  ENERGY_SPRINT_RESUME,
  HUNGER_DRAIN_IDLE,
  HUNGER_DRAIN_RUN,
  HUNGER_DRAIN_WALK,
  HEALTH_DRAIN_PER_EMPTY,
  TEMP_COLD,
  TEMP_COLD_HUNGER_MULT,
  TEMP_COOL_IDLE_NIGHT,
  TEMP_DRIFT,
  TEMP_HEAT_RUN_DAY,
  TEMP_IDLE_DAY_RECOVER,
  TEMP_HOT,
  TEMP_HOT_ENERGY_MULT,
  THIRST_DRAIN_IDLE,
  THIRST_DRAIN_RUN,
  THIRST_DRAIN_WALK,
} from "./constants";
import type { PlayerGait } from "./playerModel";

export type NeedsState = {
  energy: number;
  thirst: number;
  hunger: number;
  temperature: number;
  health: number;
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export class Needs {
  energy = 0.75;
  thirst = 0.5;
  hunger = 0.5;
  temperature = 0.5;
  health = 1;
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

  private towardComfort(dt: number, rate: number): void {
    const d = 0.5 - this.temperature;
    const step = rate * dt;
    if (Math.abs(d) <= step) this.temperature = 0.5;
    else this.temperature += Math.sign(d) * step;
  }

  /** Shade vs sun is later — for now daytime is the whole island. */
  tick(gait: PlayerGait, dt: number, daytime: boolean): void {
    const hot = this.temperature >= TEMP_HOT;
    const cold = this.temperature <= TEMP_COLD;
    const hungerMult = cold ? TEMP_COLD_HUNGER_MULT : 1;

    if (gait === "run") {
      const energyMult = hot ? TEMP_HOT_ENERGY_MULT : 1;
      this.energy -= ENERGY_DRAIN_RUN * energyMult * dt;
      this.thirst -= THIRST_DRAIN_RUN * dt;
      this.hunger -= HUNGER_DRAIN_RUN * hungerMult * dt;
      if (daytime) this.temperature += TEMP_HEAT_RUN_DAY * dt;
      else this.towardComfort(dt, TEMP_DRIFT);
    } else if (gait === "walk") {
      this.energy += ENERGY_RECOVER_WALK * dt;
      this.thirst -= THIRST_DRAIN_WALK * dt;
      this.hunger -= HUNGER_DRAIN_WALK * hungerMult * dt;
      this.towardComfort(dt, TEMP_DRIFT);
    } else {
      this.energy += ENERGY_RECOVER_IDLE * dt;
      this.thirst -= THIRST_DRAIN_IDLE * dt;
      this.hunger -= HUNGER_DRAIN_IDLE * hungerMult * dt;
      if (!daytime) this.temperature -= TEMP_COOL_IDLE_NIGHT * dt;
      else this.towardComfort(dt, TEMP_IDLE_DAY_RECOVER);
    }

    this.thirst = clamp01(this.thirst);
    this.hunger = clamp01(this.hunger);
    this.temperature = clamp01(this.temperature);
    const emptyNeeds = (this.thirst <= 0 ? 1 : 0) + (this.hunger <= 0 ? 1 : 0);
    if (emptyNeeds > 0) this.health -= HEALTH_DRAIN_PER_EMPTY * emptyNeeds * dt;
    this.health = clamp01(this.health);
    const foodAvg = (this.thirst + this.hunger) / 2;
    this.energy = Math.min(1, 1.5 * foodAvg, Math.max(0, this.energy));
    if (this.energy <= 0) this.canSprint = false;
    else if (this.energy >= ENERGY_SPRINT_RESUME) this.canSprint = true;
  }
}
