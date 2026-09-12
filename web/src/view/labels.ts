import { t } from "@/web/src/i18n";
import { itemLabelParts, type FoodPrep, type Freshness } from "@/web/src/food";
import type { ResolvedAction } from "@/web/src/sim/actions";

export function formatItemLabel(kind: string, prep?: FoodPrep, freshness: Freshness = "fresh"): string {
  const parts = itemLabelParts(kind, prep, freshness);
  const noun = t(parts.nounKey);
  const prepText = parts.prepKey ? t(parts.prepKey) : "";
  const stateText = parts.stateKey ? t(parts.stateKey) : "";
  let out = noun;
  if (prepText) out = `${out} (${prepText})`;
  if (stateText) out = `${out} [${stateText}]`;
  return out;
}

export function formatActionLabel(action: ResolvedAction): string {
  const verb = t(`action.${action.id}`);
  if (action.blocked) {
    if (action.blocked === "rotten") return t("food.state.rotten");
    return `${verb} (${t(`action.blocked.${action.blocked}`)})`;
  }
  if (action.id === "drop") return verb;
  return `${verb} [SPACE]`;
}

export function formatDeathTime(gameHours: number): string {
  const totalMinutes = Math.max(0, Math.floor(gameHours * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourText = hours === 1 ? t("hud.hourOne") : t("hud.hourMany", { n: hours });
  const minuteText = minutes === 1 ? t("hud.minuteOne") : t("hud.minuteMany", { n: minutes });
  return t("hud.survived", { time: `${hourText} + ${minuteText}` });
}
