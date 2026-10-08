import { chooseCharacter, openSmokeRoom } from "./helpers.mjs";

/** Open a dedicated smoke room, dismiss cookies, choose a character, land in-world. */
export default async ({ page, url }) => {
  await openSmokeRoom(page, url);
  await chooseCharacter(page);
  // Unlock audio / full hint without opening Say
  await page.locator("#game").click({ position: { x: 40, y: 40 } }).catch(() => {});
};
