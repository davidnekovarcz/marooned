// Accepts the cookie/consent dialog on the current page, if the site has one.
const ACCEPT = [
  "#cookie-accept", // Marooned GA cookie banner
  '#c-p-bn', '#cc-main .cm__btn[data-role="all"]',
  "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  "#CybotCookiebotDialogBodyButtonAccept",
  "#onetrust-accept-btn-handler",
  ".cm-btn-accept-all",
  ".cm-btn-accept",
  ".cc-btn.cc-allow",
  ".cc-btn.cc-dismiss",
  "#tarteaucitronPersonalize2",
  '[data-cookieconsent="accept"]',
  '[data-consent="accept"]',
  '[data-testid*="accept" i]',
  "button:has-text(/^(accept( all)?|allow( all)?|agree|i agree|ok(ay)?)$/i)",
];

export async function acceptConsent(page, { timeout = 4000 } = {}) {
  for (const selector of ACCEPT) {
    const button = page.locator(selector).first();
    if (!(await button.isVisible().catch(() => false))) continue;
    await button.click({ timeout });
    await button.waitFor({ state: "hidden", timeout }).catch(() => {});
    return selector;
  }
  const late = page.locator(ACCEPT.slice(0, 4).join(", ")).first();
  if (await late.waitFor({ state: "visible", timeout }).then(() => true, () => false)) {
    return acceptConsent(page, { timeout });
  }
  return null;
}

export default async ({ page, url }) => {
  if (page.url() !== url()) await page.goto(url(), { waitUntil: "domcontentloaded" });
  const used = await acceptConsent(page);
  console.log(used ? `  consent accepted via ${used}` : "  no consent dialog found; capturing as is");
};
