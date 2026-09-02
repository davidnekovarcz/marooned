import {
  EAT_RESTORE_RATE,
  ENERGY_DRAIN_RUN,
  ENERGY_FROM_FOOD,
  ENERGY_RECOVER_IDLE,
  ENERGY_RECOVER_WALK,
  ENERGY_SPRINT_RESUME,
  HUNGER_DRAIN_IDLE,
  HUNGER_DRAIN_RUN,
  HUNGER_DRAIN_WALK,
  HEALTH_DRAIN_PER_EMPTY,
  HEALTH_RESTORE,
  HUD_BAND_MID,
  HUD_TEMP_HOT_BLINK,
  TEMP_COLD,
  TEMP_COLD_HUNGER_MULT,
  TEMP_COOL_IDLE_NIGHT,
  TEMP_DRIFT,
  TEMP_HEAT_RUN_DAY,
  TEMP_IDLE_DAY_RECOVER,
  TEMP_HOT,
  TEMP_HOT_BLINK_THIRST_MULT,
  TEMP_HOT_ENERGY_MULT,
  TEMP_HOT_THIRST_MULT,
  TEMP_SWIM_COOL,
  THIRST_DRAIN_IDLE,
  THIRST_DRAIN_RUN,
  THIRST_DRAIN_WALK,
} from "./constants";
import type { PlayerGait } from "./playerModel";

export type NeedsState = {
  energy: number;
  energyMax: number;
  thirst: number;
  hunger: number;
  temperature: number;
  health: number;
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function energyMaxFromFood(thirst: number, hunger: number): number {
  return Math.min(1, ENERGY_FROM_FOOD * Math.sqrt(thirst * hunger));
}

export class Needs {
  energy = 0.75;
  thirst = 0.5;
  hunger = 0.5;
  temperature = 0.5;
  health = 1;
  canSprint = true;
  private pendingHunger = 0;
  private pendingThirst = 0;

  feed(hunger: number, thirst: number): void {
    this.pendingHunger += hunger;
    this.pendingThirst += thirst;
  }

  snapshot(): NeedsState {
    return {
      energy: this.energy,
      energyMax: energyMaxFromFood(this.thirst, this.hunger),
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
    const thirstMult =
      this.temperature > HUD_TEMP_HOT_BLINK
        ? TEMP_HOT_BLINK_THIRST_MULT
        : hot
          ? TEMP_HOT_THIRST_MULT
          : 1;

    if (gait === "run") {
      const energyMult = hot ? TEMP_HOT_ENERGY_MULT : 1;
      this.energy -= ENERGY_DRAIN_RUN * energyMult * dt;
      this.thirst -= THIRST_DRAIN_RUN * thirstMult * dt;
      this.hunger -= HUNGER_DRAIN_RUN * hungerMult * dt;
      if (daytime) this.temperature += TEMP_HEAT_RUN_DAY * dt;
      else this.towardComfort(dt, TEMP_DRIFT);
    } else if (gait === "walk") {
      this.energy += ENERGY_RECOVER_WALK * dt;
      this.thirst -= THIRST_DRAIN_WALK * thirstMult * dt;
      this.hunger -= HUNGER_DRAIN_WALK * hungerMult * dt;
      this.towardComfort(dt, TEMP_DRIFT);
    } else if (gait === "swim") {
      this.energy += ENERGY_RECOVER_WALK * 0.45 * dt;
      this.thirst -= THIRST_DRAIN_WALK * thirstMult * dt;
      this.hunger -= HUNGER_DRAIN_WALK * hungerMult * dt;
      this.temperature -= TEMP_SWIM_COOL * dt;
    } else {
      this.energy += ENERGY_RECOVER_IDLE * dt;
      this.thirst -= THIRST_DRAIN_IDLE * thirstMult * dt;
      this.hunger -= HUNGER_DRAIN_IDLE * hungerMult * dt;
      if (!daytime) this.temperature -= TEMP_COOL_IDLE_NIGHT * dt;
      else this.towardComfort(dt, TEMP_IDLE_DAY_RECOVER);
    }

    const restore = EAT_RESTORE_RATE * dt;
    const hungerGain = Math.min(this.pendingHunger, restore);
    const thirstGain = Math.min(this.pendingThirst, restore);
    this.hunger += hungerGain;
    this.thirst += thirstGain;
    this.pendingHunger -= hungerGain;
    this.pendingThirst -= thirstGain;

    this.thirst = clamp01(this.thirst);
    this.hunger = clamp01(this.hunger);
    this.temperature = clamp01(this.temperature);
    const emptyNeeds = (this.thirst <= 0 ? 1 : 0) + (this.hunger <= 0 ? 1 : 0);
    if (emptyNeeds > 0) this.health -= HEALTH_DRAIN_PER_EMPTY * emptyNeeds * dt;
    else if (this.thirst >= HUD_BAND_MID && this.hunger >= HUD_BAND_MID) {
      this.health += HEALTH_RESTORE * dt;
    }
    this.health = clamp01(this.health);
    this.energy = Math.min(energyMaxFromFood(this.thirst, this.hunger), Math.max(0, this.energy));
    if (this.energy <= 0) this.canSprint = false;
    else if (this.energy >= ENERGY_SPRINT_RESUME) this.canSprint = true;
  }
}
