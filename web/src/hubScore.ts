/** Tell the Playful hub how long this run lasted. Minutes sort as a high score. */
export function postSurvivalScore(deathHours: number): void {
  if (typeof window === "undefined" || window.parent === window) return;
  const score = Math.floor(Math.max(0, deathHours) * 60);
  window.parent.postMessage(
    { type: "GAME_OVER", gameName: "Marooned", score },
    "*",
  );
}
