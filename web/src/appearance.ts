/** Later: skin / clothes tints on the Kenney atlas. Gender is the only live swap for now. */
export type Appearance = {
  gender: "male" | "female";
  skin: number;
  clothes: number;
};

export const DEFAULT_APPEARANCE: Appearance = {
  gender: "male",
  skin: 0xf69878,
  clothes: 0xccdde7,
};
