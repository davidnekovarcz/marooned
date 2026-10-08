import { chooseCharacter, openSmokeRoom } from "./helpers.mjs";

/** Boot into the world, open Say, send a line, dismiss compose. */
export default async ({ page, url }) => {
  await openSmokeRoom(page, url);
  await chooseCharacter(page);
  await page.locator("#game").click({ position: { x: 40, y: 40 } }).catch(() => {});
  await page.keyboard.press("Enter");
  const input = page.locator("#say-input");
  await input.waitFor({ state: "visible", timeout: 10000 });
  await input.fill("Kaloko smoke");
  await page.keyboard.press("Enter");
  await page.locator("#say-compose").waitFor({ state: "hidden", timeout: 10000 });
};
