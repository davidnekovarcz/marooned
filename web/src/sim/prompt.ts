import type { FoodPrep, Freshness } from "@/web/src/food";
import type { ResolvedAction } from "@/web/src/sim/actions";
import type { Item } from "@/web/src/world/item";

export type PromptBand =
  | "cook"
  | "light"
  | "build"
  | "pond"
  | "fishPickup"
  | "heldMeal"
  | "shoreFish"
  | "world"
  | "wildlife";

/** Lowest index wins. Reorder this table to change Space-prompt priority. */
export const PROMPT_BANDS: readonly PromptBand[] = [
  "cook",
  "light",
  "build",
  "pond",
  "fishPickup",
  "heldMeal",
  "shoreFish",
  "world",
  "wildlife",
];

function rankOf(band: PromptBand): number {
  const rank = PROMPT_BANDS.indexOf(band);
  return rank < 0 ? PROMPT_BANDS.length : rank;
}

export type PromptChoice = {
  band: PromptBand;
  action: ResolvedAction | null;
  item: Item | null;
  promptKind: string | null;
  promptPrep?: FoodPrep;
  promptFreshness?: Freshness;
};

type PlaceBand = Extract<PromptBand, "cook" | "light" | "build" | "pond" | "shoreFish">;

export function pickPrompt(candidates: PromptChoice[]): PromptChoice | undefined {
  let best: PromptChoice | undefined;
  let bestRank = Infinity;
  for (const candidate of candidates) {
    const rank = rankOf(candidate.band);
    if (rank < bestRank) {
      best = candidate;
      bestRank = rank;
    }
  }
  return best;
}

export function bandForPlaceAction(action: ResolvedAction): PlaceBand | undefined {
  switch (action.id) {
    case "cook":
      return "cook";
    case "light":
      return "light";
    case "build":
      return "build";
    case "drink":
      return action.pond ? "pond" : undefined;
    case "fish":
      return "shoreFish";
    case "eat":
    case "peel":
    case "slice":
    case "split":
    case "open":
    case "pickup":
      return undefined;
    default: {
      const _never: never = action.id;
      return _never;
    }
  }
}

export function gatherPromptCandidates(input: {
  places: ResolvedAction[];
  hearth: Item | null;
  heldKind: string | null;
  heldPrep?: FoodPrep;
  heldFreshness?: Freshness;
  heldMeal?: ResolvedAction;
  worldItem: Item | null;
  worldAction?: ResolvedAction;
  wildlife: string | null;
}): PromptChoice[] {
  const candidates: PromptChoice[] = [];
  for (const action of input.places) {
    const band = bandForPlaceAction(action);
    if (!band) continue;
    switch (band) {
      case "cook":
        candidates.push({
          band,
          action,
          item: null,
          promptKind: input.heldKind,
          promptPrep: input.heldPrep,
          promptFreshness: input.heldFreshness,
        });
        break;
      case "light": {
        if (!input.hearth) break;
        candidates.push({
          band,
          action,
          item: input.hearth,
          promptKind: input.hearth.kind,
          promptPrep: input.hearth.prep,
          promptFreshness: input.hearth.freshness,
        });
        break;
      }
      case "build":
        candidates.push({ band, action, item: null, promptKind: "leanTo" });
        break;
      case "pond":
        candidates.push({ band, action, item: null, promptKind: "pond" });
        break;
      case "shoreFish":
        candidates.push({ band, action, item: null, promptKind: "shore" });
        break;
      default: {
        const _never: never = band;
        void _never;
      }
    }
  }

  if (input.worldItem && input.worldAction) {
    const fishPickup =
      input.worldAction.id === "pickup" &&
      (input.worldItem.kind === "fish" || input.worldItem.kind === "fishCooked");
    candidates.push({
      band: fishPickup ? "fishPickup" : "world",
      action: input.worldAction,
      item: input.worldItem,
      promptKind: input.worldItem.kind,
      promptPrep: input.worldItem.prep,
      promptFreshness: input.worldItem.freshness,
    });
  }

  if (input.heldMeal) {
    candidates.push({
      band: "heldMeal",
      action: input.heldMeal,
      item: null,
      promptKind: input.heldKind,
      promptPrep: input.heldPrep,
      promptFreshness: input.heldFreshness,
    });
  }

  if (input.wildlife) {
    candidates.push({
      band: "wildlife",
      action: null,
      item: null,
      promptKind: input.wildlife,
    });
  }

  return candidates;
}

export function smokePromptPriority(): void {
  const stub = (band: PromptBand): PromptChoice => ({
    band,
    action: null,
    item: null,
    promptKind: band,
  });
  const pick = (...bands: PromptBand[]) => pickPrompt(bands.map(stub))?.band;
  const expect = (name: string, got: string | undefined, want: string) => {
    if (got !== want) throw new Error(`prompt priority ${name}: expected ${want}, got ${got}`);
  };
  expect("cook over meal", pick("heldMeal", "cook"), "cook");
  expect("light over loot", pick("world", "light"), "light");
  expect("build over pond", pick("pond", "build"), "build");
  expect("pond over meal", pick("heldMeal", "pond"), "pond");
  expect("fish pickup over meal", pick("heldMeal", "fishPickup", "shoreFish"), "fishPickup");
  expect("meal over shore", pick("shoreFish", "heldMeal"), "heldMeal");
  expect("shore over loot", pick("world", "shoreFish"), "shoreFish");
  expect("loot over wildlife", pick("wildlife", "world"), "world");
  expect("wildlife last", pick("wildlife"), "wildlife");

  const fakeItem = (kind: string) => ({ kind }) as Item;
  expect(
    "gather cook",
    pickPrompt(
      gatherPromptCandidates({
        places: [{ id: "cook", cook: true }],
        hearth: null,
        heldKind: "fish",
        heldMeal: { id: "eat", eatHeld: true },
        worldItem: null,
        wildlife: "crab",
      }),
    )?.band,
    "cook",
  );
  expect(
    "gather pond over meal",
    pickPrompt(
      gatherPromptCandidates({
        places: [{ id: "drink", pond: true }],
        hearth: null,
        heldKind: "coconut",
        heldMeal: { id: "eat", eatHeld: true },
        worldItem: null,
        wildlife: null,
      }),
    )?.band,
    "pond",
  );
  expect(
    "gather fish pickup",
    pickPrompt(
      gatherPromptCandidates({
        places: [{ id: "fish", fish: true }],
        hearth: null,
        heldKind: "coconut",
        heldMeal: { id: "eat", eatHeld: true },
        worldItem: fakeItem("fish"),
        worldAction: { id: "pickup", pickup: "fish" },
        wildlife: null,
      }),
    )?.band,
    "fishPickup",
  );
  expect(
    "gather blocked fish over loot",
    pickPrompt(
      gatherPromptCandidates({
        places: [{ id: "fish", blocked: "needPole" }],
        hearth: null,
        heldKind: null,
        worldItem: fakeItem("coconut"),
        worldAction: { id: "pickup", pickup: "coconut" },
        wildlife: null,
      }),
    )?.band,
    "shoreFish",
  );
  expect(
    "gather loot over wildlife",
    pickPrompt(
      gatherPromptCandidates({
        places: [],
        hearth: null,
        heldKind: null,
        worldItem: fakeItem("stick"),
        worldAction: { id: "pickup", pickup: "stick" },
        wildlife: "crab",
      }),
    )?.band,
    "world",
  );
  expect(
    "gather wildlife",
    pickPrompt(
      gatherPromptCandidates({
        places: [],
        hearth: null,
        heldKind: null,
        worldItem: null,
        wildlife: "crab",
      }),
    )?.band,
    "wildlife",
  );
  const tooWet = gatherPromptCandidates({
    places: [{ id: "light", light: true, blocked: "tooWet" }],
    hearth: fakeItem("hearth"),
    heldKind: "tinder",
    worldItem: fakeItem("stick"),
    worldAction: { id: "pickup", pickup: "stick" },
    wildlife: null,
  });
  expect("gather tooWet light over loot", pickPrompt(tooWet)?.band, "light");
  expect("gather tooWet stays blocked", pickPrompt(tooWet)?.action?.blocked, "tooWet");
  expect(
    "gather build",
    pickPrompt(
      gatherPromptCandidates({
        places: [{ id: "build", build: true }],
        hearth: null,
        heldKind: "hammer",
        worldItem: fakeItem("stick"),
        worldAction: { id: "pickup", pickup: "stick" },
        wildlife: null,
      }),
    )?.promptKind,
    "leanTo",
  );
  expect(
    "gather held fruit",
    pickPrompt(
      gatherPromptCandidates({
        places: [],
        hearth: null,
        heldKind: "banana",
        heldMeal: { id: "eat", eatHeld: true },
        worldItem: null,
        wildlife: null,
      }),
    )?.band,
    "heldMeal",
  );
}
