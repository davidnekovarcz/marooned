import { chooseCharacter, deleteKalokoRoom, openSmokeRoom } from "./helpers.mjs";
import { clickAction, qa } from "./qa.mjs";

/** Dry sky, hold tinder, light the hut hearth. */
export default async ({ page, url }) => {
  try {
    const fresh = url().replace(/room=[^&]+/, `room=kaloko-fire-${Date.now()}`);
    await openSmokeRoom(page, () => fresh);
    await chooseCharacter(page);
    const api = await qa(page);
    await api.call("setRaining", false);
    if (!(await api.call("give", "tinder"))) throw new Error("could not give tinder");
    if (!(await api.call("goLandmark", "hutFire"))) throw new Error("hut fire landmark missing");
    await clickAction(page, "Light fire");
    await page.waitForFunction(() => document.body.dataset.qaFire === "1", null, { timeout: 8000 });
  } finally {
    await deleteKalokoRoom(page);
  }
};
