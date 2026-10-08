/** Shared helpers for Marooned Kaloko smoke steps. */

import { acceptConsent } from "./consent.mjs";

/** Fresh visitor: clear Marooned storage so character gate always shows. */
export async function resetVisitor(page) {
  await page.evaluate(() => {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("marooned.")) keys.push(k);
      }
      for (const k of keys) localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  });
}

/** Open the step's configured path (query included). `url(arg)` looks up a step id — use `url()` only. */
export async function openSmokeRoom(page, url) {
  const target = url();
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await resetVisitor(page);
  await page.goto(target, { waitUntil: "domcontentloaded" });
  await acceptConsent(page, { timeout: 3000 });
}

/** Wait until character select is ready (Firebase join + gate). */
export async function waitForCharacterGate(page, timeout = 45000) {
  const play = page.locator("#character-play");
  await play.waitFor({ state: "visible", timeout });
}

export async function chooseCharacter(page) {
  await waitForCharacterGate(page);
  await page.locator("#character-play").click();
  await page.locator("#character").waitFor({ state: "hidden", timeout: 30000 });
  // #hud-bar is display:contents — wait for a real box inside it
  await page.locator("#hud-clock").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#gear").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#game").waitFor({ state: "attached", timeout: 15000 });
}
