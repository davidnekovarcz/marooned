/** Kenney survivor atlas: gender swaps the PNG; skin/clothes are tinted from the source peaches/blues. */
export type Gender = "male" | "female";

export type Appearance = {
  gender: Gender;
  skin: number;
  clothes: number;
};

export type Character = Appearance & {
  name: string;
};

export const SKIN_TONES = [
  0xf7d3c0, 0xf69878, 0xe0a06c, 0xc68642, 0x8d5524, 0x5c3317, 0x3b2219,
] as const;

export const CLOTHES_TONES = [
  0xccdde7, 0xf4f7f2, 0x4a7c59, 0xc45a3a, 0x2c4a6e, 0xe8c84a, 0x5a4a7a, 0x3a3a3c,
] as const;

/** Source peach on survivorMaleB. */
export const MALE_SKIN_SRC = 0xf69878;
/** Source brick-red on survivorFemaleA. */
export const FEMALE_SKIN_SRC = 0xa83c34;
export const MALE_CLOTHES_SRC = 0xccdde7;
export const FEMALE_CLOTHES_SRC = 0xb7d3ea;

export const DEFAULT_APPEARANCE: Appearance = {
  gender: "male",
  skin: SKIN_TONES[1],
  clothes: CLOTHES_TONES[0],
};

const STORAGE_KEY = "marooned.character";

const NAME_A = [
  "Quiet",
  "Lost",
  "Drift",
  "Salt",
  "Low",
  "Far",
  "Pale",
  "Last",
  "Grey",
  "Still",
  "Bare",
  "New",
];
const NAME_B = [
  "Tern",
  "Cay",
  "Hull",
  "Palm",
  "Reef",
  "Gull",
  "Wake",
  "Ash",
  "Knot",
  "Marsh",
  "Finch",
  "Cove",
];

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

export function randomName(): string {
  return `${pick(NAME_A)} ${pick(NAME_B)}`;
}

export function randomAppearance(): Appearance {
  return {
    gender: Math.random() < 0.5 ? "male" : "female",
    skin: pick(SKIN_TONES),
    clothes: pick(CLOTHES_TONES),
  };
}

export function randomCharacter(): Character {
  return { name: randomName(), ...randomAppearance() };
}

export function defaultCharacter(): Character {
  return { name: randomName(), ...DEFAULT_APPEARANCE };
}

function clampName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, 24);
}

export function parseCharacter(raw: unknown): Character | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? clampName(o.name) : "";
  const gender = o.gender === "female" ? "female" : o.gender === "male" ? "male" : null;
  const skin = typeof o.skin === "number" && Number.isFinite(o.skin) ? o.skin : null;
  const clothes = typeof o.clothes === "number" && Number.isFinite(o.clothes) ? o.clothes : null;
  if (!name || !gender || skin === null || clothes === null) return null;
  return { name, gender, skin, clothes };
}

export function loadSavedCharacter(): Character | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseCharacter(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function saveCharacter(character: Character): void {
  const next: Character = {
    name: clampName(character.name) || randomName(),
    gender: character.gender,
    skin: character.skin,
    clothes: character.clothes,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function markAutostart(): void {
  sessionStorage.setItem("marooned.autostart", "1");
}

export function consumeAutostart(): Character | null {
  try {
    if (sessionStorage.getItem("marooned.autostart") !== "1") return null;
    sessionStorage.removeItem("marooned.autostart");
    return loadSavedCharacter();
  } catch {
    return null;
  }
}

export function sourceSkin(gender: Gender): number {
  return gender === "female" ? FEMALE_SKIN_SRC : MALE_SKIN_SRC;
}

export function sourceClothes(gender: Gender): number {
  return gender === "female" ? FEMALE_CLOTHES_SRC : MALE_CLOTHES_SRC;
}
