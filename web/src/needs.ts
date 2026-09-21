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
  HEALTH_COLD_WET_DRAIN,
  HEALTH_DRAIN_PER_EMPTY,
  HEALTH_POISON_DRAIN,
  HEALTH_RESTORE,
  HUD_BAND_MID,
  HUD_TEMP_HOT_BLINK,
  TEMP_COLD,
  TEMP_COLD_HUNGER_MULT,
  TEMP_COOL_IDLE_NIGHT,
  TEMP_DRIFT,
  TEMP_FIRE_WARM,
  TEMP_HEAT_RUN_DAY,
  TEMP_IDLE_DAY_RECOVER,
  TEMP_HOT,
  TEMP_HOT_BLINK_THIRST_MULT,
  TEMP_HOT_ENERGY_MULT,
  TEMP_HOT_THIRST_MULT,
  TEMP_NIGHT_COMFORT,
  TEMP_SWIM_COOL,
  TEMP_TORCH_WARM,
  TEMP_WET_DAY,
  TEMP_WET_DAY_FLOOR,
  TEMP_WET_NIGHT,
  TEMP_WET_NIGHT_FLOOR,
  TEMP_WET_STORM_FLOOR,
  THIRST_DRAIN_IDLE,
  THIRST_DRAIN_RUN,
  THIRST_DRAIN_WALK,
  WET_FIRE_DRY,
  WET_NIGHT_DRY,
  WET_RAIN,
  WET_SHELTER_DRY,
  WET_SUN_DRY,
  WET_SWIM,
  WET_TORCH_DRY,
} from "@/web/src/constants";
import type { PlayerGait } from "@/web/src/playerModel";

export type NeedsState = {
  energy: number;
  energyMax: number;
  thirst: number;
  hunger: number;
  temperature: number;
  wetness: number;
  health: number;
};

export type NeedsClimate = {
  daytime: boolean;
  rain: number;
  sheltered: boolean;
  fire: number;
  torch: boolean;
  swimming: boolean;
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
  wetness = 0;
  health = 1;
  canSprint = true;
  private pendingHunger = 0;
  private pendingThirst = 0;
  private poisoned = false;

  feed(hunger: number, thirst: number): void {
    this.pendingHunger += hunger;
    this.pendingThirst += thirst;
  }

  poison(): void {
    this.poisoned = true;
  }

  snapshot(): NeedsState {
    return {
      energy: this.energy,
      energyMax: energyMaxFromFood(this.thirst, this.hunger),
      thirst: this.thirst,
      hunger: this.hunger,
      temperature: this.temperature,
      wetness: this.wetness,
      health: this.health,
    };
  }

  restore(state: Partial<Omit<NeedsState, "energyMax">>): void {
    if (typeof state.energy === "number") this.energy = clamp01(state.energy);
    if (typeof state.thirst === "number") this.thirst = clamp01(state.thirst);
    if (typeof state.hunger === "number") this.hunger = clamp01(state.hunger);
    if (typeof state.temperature === "number") this.temperature = clamp01(state.temperature);
    if (typeof state.wetness === "number") this.wetness = clamp01(state.wetness);
    if (typeof state.health === "number") this.health = clamp01(state.health);
    this.energy = Math.min(energyMaxFromFood(this.thirst, this.hunger), this.energy);
    this.canSprint = this.energy >= ENERGY_SPRINT_RESUME;
  }

  private towardComfort(dt: number, rate: number, target = 0.5): void {
    const d = target - this.temperature;
    const step = rate * dt;
    if (Math.abs(d) <= step) this.temperature = target;
    else this.temperature += Math.sign(d) * step;
  }

  tick(gait: PlayerGait, dt: number, climate: NeedsClimate): void {
    const { daytime, rain, sheltered, fire, torch, swimming } = climate;
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
    } else if (gait === "walk") {
      this.energy += ENERGY_RECOVER_WALK * dt;
      this.thirst -= THIRST_DRAIN_WALK * thirstMult * dt;
      this.hunger -= HUNGER_DRAIN_WALK * hungerMult * dt;
    } else if (gait === "swim") {
      this.energy += ENERGY_RECOVER_WALK * 0.45 * dt;
      this.thirst -= THIRST_DRAIN_WALK * thirstMult * dt;
      this.hunger -= HUNGER_DRAIN_WALK * hungerMult * dt;
    } else {
      this.energy += ENERGY_RECOVER_IDLE * dt;
      this.thirst -= THIRST_DRAIN_IDLE * thirstMult * dt;
      this.hunger -= HUNGER_DRAIN_IDLE * hungerMult * dt;
    }

    if (swimming) this.wetness += WET_SWIM * dt;
    else if (rain > 0.05 && !sheltered) this.wetness += WET_RAIN * rain * dt;
    if (fire > 0) this.wetness -= WET_FIRE_DRY * fire * dt;
    else if (torch) this.wetness -= WET_TORCH_DRY * dt;
    else if (sheltered) this.wetness -= WET_SHELTER_DRY * dt;
    else if (rain < 0.08) this.wetness -= (daytime ? WET_SUN_DRY : WET_NIGHT_DRY) * dt;

    const wet = clamp01(this.wetness);
    let target = daytime ? 0.5 : TEMP_NIGHT_COMFORT;
    if (wet > 0.05) {
      const stormSoak = !daytime && rain > 0.3 && !sheltered && fire <= 0 && wet >= 0.65;
      const floor = daytime ? TEMP_WET_DAY_FLOOR : stormSoak ? TEMP_WET_STORM_FLOOR : TEMP_WET_NIGHT_FLOOR;
      target -= (target - floor) * wet;
    }
    if (fire > 0) {
      this.towardComfort(dt, TEMP_FIRE_WARM * fire, Math.max(target, 0.64));
    } else if (torch && !daytime) {
      this.towardComfort(dt, TEMP_TORCH_WARM, Math.max(target, 0.42));
    } else {
      const chilling = this.temperature > target;
      const wetRate = wet * (daytime ? TEMP_WET_DAY : TEMP_WET_NIGHT);
      const climateRate = gait === "idle" && !daytime ? TEMP_COOL_IDLE_NIGHT : daytime ? TEMP_IDLE_DAY_RECOVER : TEMP_DRIFT;
      this.towardComfort(dt, chilling ? Math.max(climateRate, wetRate) : climateRate, target);
    }
    if (gait === "run" && daytime) this.temperature += TEMP_HEAT_RUN_DAY * dt;
    else if (gait === "swim") this.temperature -= TEMP_SWIM_COOL * dt;

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
    this.wetness = clamp01(this.wetness);
    if (this.poisoned) {
      this.health -= HEALTH_POISON_DRAIN * dt;
    } else {
      const emptyNeeds = (this.thirst <= 0 ? 1 : 0) + (this.hunger <= 0 ? 1 : 0);
      if (emptyNeeds > 0) this.health -= HEALTH_DRAIN_PER_EMPTY * emptyNeeds * dt;
      else if (this.thirst >= HUD_BAND_MID && this.hunger >= HUD_BAND_MID) {
        this.health += HEALTH_RESTORE * dt;
      }
      if (this.temperature <= 0.12 && this.wetness >= 0.85 && !daytime && fire <= 0) {
        this.health -= HEALTH_COLD_WET_DRAIN * dt;
      }
    }
    this.health = clamp01(this.health);
    this.energy = Math.min(energyMaxFromFood(this.thirst, this.hunger), Math.max(0, this.energy));
    if (this.energy <= 0) this.canSprint = false;
    else if (this.energy >= ENERGY_SPRINT_RESUME) this.canSprint = true;
  }
}
