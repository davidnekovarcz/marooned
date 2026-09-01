export const GRID = 100;
export const CELL = 1;
export const CENTER = 49.5;
export const ISLAND_RADIUS = 42;
export const BEACH_WIDTH = 5;
export const WATER_Y = -0.15;
export const STEP_SECONDS = 0.15;
export const CAMERA_OFFSET = { x: 16, y: 22, z: 16 } as const;
export const SEED = "marooned-mvp-1";

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
