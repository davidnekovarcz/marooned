export const GRID = 160;
export const CELL = 1;
export const CENTER = 79.5;
export const ISLAND_RADIUS = 68;
export const BEACH_WIDTH = 7;
export const WATER_Y = -0.15;
export const GROUND_Y = 0.02;
/** Seconds per grid step when walking (default). */
export const STEP_SECONDS_WALK = 0.24;
/** Seconds per grid step when holding Shift. */
export const STEP_SECONDS_RUN = 0.09;
/** Run-clip playback while walking — unchanged from the first character pass. */
export const WALK_ANIM_SCALE = 0.72;
/** Run-clip playback while sprinting. */
export const RUN_ANIM_SCALE = 1.05;
export const CAMERA_OFFSET = { x: -18, y: 24, z: -18 } as const;
export const ZOOM_CELLS_IN = 10;
/** Horizontal span ≈ half the island (radius cells). */
export const ZOOM_CELLS_OUT = ISLAND_RADIUS;
export const ZOOM_CELLS_START = 24;
export const ZOOM_CELLS_PER_SEC = 28;
export const SEED = "marooned-mvp-1";
/** Distance falloff always. Stereo L/R from facing / side only if true. */
export const SOUND_3D = false;

/** Real seconds for a full 24h island day. */
export const DAY_SECONDS = 8 * 60;
/** Start a bit after dawn so the first load is daytime. */
export const DAY_START = 8 / 24;

/** Energy 0→empty in this many seconds of sprint (before heat extra). */
export const ENERGY_DRAIN_RUN = 1 / 7;
/** Energy empty→full while standing still. */
export const ENERGY_RECOVER_IDLE = 1 / 3;
/** Energy empty→full while walking. */
export const ENERGY_RECOVER_WALK = 1 / 12;
/** Must refill past this before sprint is allowed again. */
export const ENERGY_SPRINT_RESUME = 0.08;

/** Thirst empty in this many idle seconds. */
export const THIRST_DRAIN_IDLE = 1 / (18 * 60);
export const THIRST_DRAIN_WALK = 1 / (10 * 60);
export const THIRST_DRAIN_RUN = 1 / (5 * 60);
/** Hunger is a bit slower than thirst. */
export const HUNGER_DRAIN_IDLE = 1 / (24 * 60);
export const HUNGER_DRAIN_WALK = 1 / (14 * 60);
export const HUNGER_DRAIN_RUN = 1 / (7 * 60);

/** Sprint in daylight: empty→hot in this many seconds. */
export const TEMP_HEAT_RUN_DAY = 1 / 28;
/** Idle at night: comfortable→cold in this many seconds. */
export const TEMP_COOL_IDLE_NIGHT = 1 / 50;
/** Idle in daylight: return to 50% in about this many seconds from full heat. */
export const TEMP_IDLE_DAY_RECOVER = 1 / 55;
/** Walking: slower drift back to 50%. */
export const TEMP_DRIFT = 1 / 40;
export const TEMP_HOT = 0.78;
export const TEMP_COLD = 0.22;
/** Extra stamina drain when overheated (sprint). */
export const TEMP_HOT_ENERGY_MULT = 1.7;
/** Extra hunger drain when too cold (all gaits). */
export const TEMP_COLD_HUNGER_MULT = 1.7;

/** HUD fill bands (also used for food/water/energy warning colors). */
export const HUD_BAND_HIGH = 0.7;
export const HUD_BAND_MID = 0.5;
export const HUD_BAND_LOW = 0.3;
export const HUD_BLINK = 0.2;
/** Health empty→dead if one of food/water stays at 0. */
export const HEALTH_DRAIN_PER_EMPTY = 2 / (3 * 60);

export const POND_X = 58;
export const POND_Z = 82;
export const POND_RADIUS = 4.6;

export const GRASS_A = 0x7fe046;
export const GRASS_B = 0x5ab83a;
export const SAND_A = 0xf6d56a;
export const SAND_B = 0xe0bc62;
export const WATER = 0x0d5a75;

export enum Biome {
  Water = 0,
  Sand = 1,
  Grass = 2,
}
