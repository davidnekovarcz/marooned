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
/** Inland pond / river — slower than a land walk. */
export const STEP_SECONDS_SWIM = 0.4;
/** How far the body sinks into inland water (model local Y). */
export const SWIM_SINK = 0.52;
/** Run-clip playback while walking — unchanged from the first character pass. */
export const WALK_ANIM_SCALE = 0.72;
/** Run-clip playback while sprinting. */
export const RUN_ANIM_SCALE = 1.05;
export const CAMERA_OFFSET = { x: -18, y: 24, z: -18 } as const;
export const ZOOM_CELLS_IN = 10;
/** Horizontal span ≈ half the island (radius cells). */
export const ZOOM_CELLS_OUT = ISLAND_RADIUS;
export const ZOOM_CELLS_START = 16;
export const ZOOM_CELLS_PER_SEC = 28;
/** Night fog pulls near/far in by this factor (1 = day distance). */
export const FOG_NIGHT_SCALE = 0.22;
/** Extra dawn haze on top of the zoom fog. */
export const FOG_DAWN_SCALE = 0.76;
/** Extra close fog while raining. */
export const FOG_RAIN_SCALE = 0.62;
export const SEED = "marooned-mvp-1";
/** Distance falloff always. Stereo L/R from facing / side only if true. */
export const SOUND_3D = false;
/** Walkable-cell outline — off so terrain blends read as one surface. */
export const DEBUG_GRID = false;

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
/** Energy ceiling = min(1, this × geometric mean of thirst and hunger). */
export const ENERGY_FROM_FOOD = 1.5;

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
/** Extra thirst drain when overheated. */
export const TEMP_HOT_THIRST_MULT = 1.7;
/** Extra thirst drain while the temperature meter is pulsing hot. */
export const TEMP_HOT_BLINK_THIRST_MULT = 2.8;
/** Extra hunger drain when too cold (all gaits). */
export const TEMP_COLD_HUNGER_MULT = 1.7;

/** HUD fill bands (also used for food/water/energy warning colors). */
export const HUD_BAND_HIGH = 0.7;
export const HUD_BAND_MID = 0.5;
export const HUD_BAND_LOW = 0.3;
export const HUD_BLINK = 0.2;
/** Temperature overheat pulse (fill already turns red at HUD_BAND_HIGH). */
export const HUD_TEMP_HOT_BLINK = 0.9;
/** Pulse the energy cell when its food/water cap is below this. */
export const HUD_ENERGY_MAX_BLINK = 0.1;
/** Health empty→dead if one of food/water stays at 0. */
export const HEALTH_DRAIN_PER_EMPTY = 2 / (3 * 60);
/** Health 0→full while food and water are both out of the yellow HUD band. */
export const HEALTH_RESTORE = 1 / (4 * 60);

/** Drink from a coconut with a hole. */
export const EAT_DRINK_HOLE_THIRST = 0.2;
export const EAT_DRINK_HOLE_HUNGER = 0.05;
/** Coconut half: more food, a little drink. */
export const EAT_COCONUT_HUNGER = 0.15;
export const EAT_COCONUT_THIRST = 0.05;
/** Juicy fruit / peeled pineapple / sliced melon / tan mushroom. */
export const EAT_FRUIT_HUNGER = 0.1;
export const EAT_FRUIT_THIRST = 0.15;
/** Seconds to apply a typical 0.15 bite on the HUD. */
export const EAT_RESTORE_SECONDS = 6;
export const EAT_RESTORE_RATE = 0.15 / EAT_RESTORE_SECONDS;
/** Locked crouch + eat/drink (no walking). */
export const EAT_ACTION_SECONDS = 3;
/** Peel / slice / open with a held knife. */
export const CUT_SECONDS = 2.2;
/** Split a coconut with a hammer. */
export const BREAK_SECONDS = 2.2;
/** Red mushroom: health empty→dead in this many seconds. */
export const HEALTH_POISON_DRAIN = 1 / 8;
/** Extra cooling while swimming inland water. */
export const TEMP_SWIM_COOL = 1 / 35;
/** Wet clothes pull temperature down (stronger at night). */
export const TEMP_WET_DAY = 1 / 90;
export const TEMP_WET_NIGHT = 1 / 28;
/** Fire warmth: empty→comfortable in this many seconds at full radius. */
export const TEMP_FIRE_WARM = 1 / 14;
/** Held torch: slow night warmth. */
export const TEMP_TORCH_WARM = 1 / 55;

/** Rain soaks clothes empty→wet in this many seconds in a full shower. */
export const WET_RAIN = 1 / 22;
/** Swimming soaks faster. */
export const WET_SWIM = 1 / 10;
export const WET_FIRE_DRY = 1 / 9;
export const WET_TORCH_DRY = 1 / 36;
export const WET_SUN_DRY = 1 / 70;
export const WET_SHELTER_DRY = 1 / 40;
/** Hypothermia: extra health drain when freezing and soaked. */
export const HEALTH_COLD_WET_DRAIN = 1 / (90);

export const DRINK_POND_THIRST = 0.32;
export const DRINK_POND_SECONDS = 2.4;
export const FISH_SECONDS = 4.6;
export const FISH_HUNGER = 0.12;
export const FISH_COOKED_HUNGER = 0.38;
export const FISH_COOKED_THIRST = 0.08;
export const LIGHT_SECONDS = 1.8;
export const COOK_SECONDS = 2.6;
export const BUILD_SECONDS = 3.4;
export const LEAN_TO_STICKS = 2;
export const LEAN_TO_FIBER = 1;
export const HEARTH_WARM_CELLS = 3;
export const HEARTH_USE_CELLS = 2;
export const SHELTER_CELLS = 1;

/** Fresh fruit sits this many island-hours before it rots. */
export const LOOT_FRESH_HOURS = 4;
/** Rotten fruit stays visible this many island-hours, then despawns. */
export const LOOT_ROTTEN_HOURS = 1;
/** Empty fruit/tool slot waits this many island-hours before spawning elsewhere. */
export const LOOT_RESPAWN_HOURS = 2;
/** Don't respawn fruit within this many cells of the player. */
export const LOOT_SPAWN_AWAY = 18;
export const LOOT_FRESH_SECONDS = (LOOT_FRESH_HOURS / 24) * DAY_SECONDS;
export const LOOT_ROTTEN_SECONDS = (LOOT_ROTTEN_HOURS / 24) * DAY_SECONDS;
export const LOOT_RESPAWN_SECONDS = (LOOT_RESPAWN_HOURS / 24) * DAY_SECONDS;
/** Tools wait a bit longer than fruit after being taken. */
export const TOOL_RESPAWN_SECONDS = (3 / 24) * DAY_SECONDS;

export const POND_X = 58;
export const POND_Z = 82;
export const POND_RADIUS = 4.6;
/** Half-width of the outlet stream (cells). */
export const RIVER_HALF = 1.55;

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
