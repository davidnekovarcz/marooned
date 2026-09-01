export const GRID = 160;
export const CELL = 1;
export const CENTER = 79.5;
export const ISLAND_RADIUS = 68;
export const BEACH_WIDTH = 7;
export const WATER_Y = -0.15;
export const GROUND_Y = 0.02;
export const STEP_SECONDS = 0.15;
export const CAMERA_OFFSET = { x: -18, y: 24, z: -18 } as const;
export const ZOOM_CELLS_IN = 10;
/** Horizontal span ≈ half the island (radius cells). */
export const ZOOM_CELLS_OUT = ISLAND_RADIUS;
export const ZOOM_CELLS_START = 24;
export const ZOOM_CELLS_PER_SEC = 28;
export const SEED = "marooned-mvp-1";

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
