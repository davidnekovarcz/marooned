import { chooseCharacter, deleteKalokoRoom, openSmokeRoom } from "./helpers.mjs";

/** Phone viewport: force size before boot so matchMedia enables body.mobile-ui. */
export default async ({ page, url }) => {
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSmokeRoom(page, url);
    await chooseCharacter(page);
    // Ensure media query has applied (Vite HMR / late listeners)
    await page.waitForFunction(() => document.body.classList.contains("mobile-ui"), null, {
      timeout: 10000,
    });
    await page.locator("#mobile-controls:not([hidden])").waitFor({ state: "visible", timeout: 10000 });
    await page.locator("#mobile-toolbar:not([hidden])").waitFor({ state: "visible", timeout: 10000 });
  } finally {
    await deleteKalokoRoom(page);
  }
};
