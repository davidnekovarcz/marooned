/** Helpers for ?qa=1 survival walks. */

export async function qa(page) {
  await page.waitForFunction(() => window.__maroonedQa, null, { timeout: 45000 });
  return {
    async call(method, ...args) {
      return page.evaluate(
        ({ method, args }) => {
          const api = window.__maroonedQa;
          if (!api || typeof api[method] !== "function") return false;
          return api[method](...args);
        },
        { method, args },
      );
    },
  };
}

export async function clickAction(page, label) {
  const button = page.locator("#interact-action");
  await button.waitFor({ state: "visible", timeout: 15000 });
  if (label) {
    await page.waitForFunction(
      (text) => {
        const el = document.querySelector("#interact-action");
        return el && !el.disabled && (el.textContent || "").includes(text);
      },
      label,
      { timeout: 15000 },
    );
  }
  await button.click();
}
