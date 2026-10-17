/**
 * Read every audit page out of the running app and print what it SHOWS,
 * as JSON on stdout. Used by scripts/audit-chain.py for its last link.
 *
 * This is the only place in the verification chain that looks at rendered
 * output rather than at data, which is the whole reason it exists: the unit
 * tests prove the engine agrees with the arithmetic, and this proves the
 * screen agrees with the engine.
 *
 *   node scripts/scrape-audit-pages.mjs > screen.json
 *
 * Needs the app on :3000 and Playwright resolvable. Playwright is NOT a
 * dependency of this project and must not become one — set
 * PLAYWRIGHT_NODE_PATH to a node_modules directory that has it. Both are
 * dev-time only; nothing here ships.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

// Resolved at runtime, not imported statically: Playwright is a dev-time
// tool and NOT a dependency of this project (three runtime deps, and it
// stays that way). PLAYWRIGHT_NODE_PATH points at a node_modules directory
// that has it. Never symlink one into this project's node_modules — the
// bundler then tries to follow it when building the app itself.
const require = createRequire(
  process.env.PLAYWRIGHT_NODE_PATH
    ? `${process.env.PLAYWRIGHT_NODE_PATH}/`
    : import.meta.url,
);
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CHROME =
  process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const ts = readFileSync(
  new URL("../src/lib/ehss/recorded.ts", import.meta.url),
  "utf8",
);
const ids = [
  ...ts.slice(ts.indexOf("export const audits")).matchAll(/\n    id: "([^"]+)"/g),
].map((m) => m[1]);

const browser = await chromium.launch({ executablePath: CHROME });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
// The app gates on an onboarding cookie; the role only decides which
// controls appear, and none of them change a figure.
await context.addCookies([
  {
    name: "demo_profile",
    value: encodeURIComponent(JSON.stringify({ name: "audit", role: "admin" })),
    domain: new URL(BASE).hostname,
    path: "/",
  },
]);

const page = await context.newPage();
const out = {};
for (const id of ids) {
  await page.goto(`${BASE}/audits/${id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  out[id] = {
    // The Health & Safety figure, read off its scorecard tab. It used to sit
    // in a read-only field in a five-discipline grid; that grid became the
    // tab strip when each discipline got its own audit screen.
    hs: await page
      .locator('.dsc-tabs button[aria-selected="true"] strong')
      .first()
      .innerText(),
    sections: await page.locator(".section-head .section-score").allInnerTexts(),
    areas: await page.evaluate(() =>
      Object.fromEntries(
        [...document.querySelectorAll(".q-area")].map((el) => [
          el.id.replace("area-", ""),
          el.querySelector(".q-category .section-score")?.textContent?.trim(),
        ]),
      ),
    ),
  };
}

await browser.close();
process.stdout.write(JSON.stringify(out));
