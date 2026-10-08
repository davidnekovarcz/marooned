import { chooseCharacter, deleteKalokoRoom, openSmokeRoom } from "./helpers.mjs";
import { qa } from "./qa.mjs";

/** Empty hunger and thirst so the real needs tick drains health to death. */
export default async ({ page, url }) => {
  try {
    const fresh = url().replace(/room=[^&]+/, `room=kaloko-death-${Date.now()}`);
    await openSmokeRoom(page, () => fresh);
    await chooseCharacter(page);
    const api = await qa(page);
    await api.call("setNeeds", { hunger: 0, thirst: 0, health: 0.08 });
    await page.locator("#death:not([hidden])").waitFor({ state: "visible", timeout: 20000 });
  } finally {
    await deleteKalokoRoom(page);
  }
};
