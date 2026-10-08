import { chooseCharacter, deleteKalokoRoom, openSmokeRoom } from "./helpers.mjs";
import { clickAction, qa } from "./qa.mjs";

/** Pick up the wreck pole, stand on a shore, and catch a fish. */
export default async ({ page, url }) => {
  try {
    const fresh = url().replace(/room=[^&]+/, `room=kaloko-fish-${Date.now()}`);
    await openSmokeRoom(page, () => fresh);
    await chooseCharacter(page);
    const api = await qa(page);
    if (!(await api.call("goLandmark", "fishingPole"))) throw new Error("fishing pole landmark missing");
    await clickAction(page, "Pick up");
    await page.waitForFunction(() => document.body.dataset.qaHeld === "fishingPole", null, { timeout: 8000 });
    if (!(await api.call("goLandmark", "shore"))) throw new Error("no shore cell");
    await clickAction(page, "Fish");
    await page.waitForFunction(() => document.body.dataset.qaHeld === "fish", null, { timeout: 12000 });
  } finally {
    await deleteKalokoRoom(page);
  }
};
