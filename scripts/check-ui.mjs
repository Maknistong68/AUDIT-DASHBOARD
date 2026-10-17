/**
 * The UI regressions that have actually happened here, as one command.
 *
 *   npm run dev
 *   PLAYWRIGHT_NODE_PATH=/path/to/node_modules node scripts/check-ui.mjs
 *
 * Exit 0 when every page is clean, 1 otherwise, naming what failed.
 *
 * Three checks, each earned by a real defect:
 *
 *  1. SIDEWAYS SCROLL. A chart whose measured-width floor was wider than a
 *     phone card pushed the whole page sideways at 320px. The type gate and
 *     126 tests passed; only looking at it found it.
 *  2. CONSOLE ERRORS. A page that throws on mount still renders a shell, so
 *     a screenshot looks fine and the page is broken.
 *  3. PRINT CONTRAST. The screen palette is dark; the print block turned
 *     cards white and left the ink alone, so the hero score, every heading
 *     and every table value printed WHITE ON WHITE — measured at 1.26:1.
 *     A director PDFs this for a meeting and gets blank pages. Nothing in
 *     the build or the tests can see that; this can.
 *
 * Playwright is a dev-time tool and NOT a dependency of this project — set
 * PLAYWRIGHT_NODE_PATH to a node_modules directory that has it.
 */
import { createRequire } from "node:module";

const require = createRequire(
  process.env.PLAYWRIGHT_NODE_PATH
    ? `${process.env.PLAYWRIGHT_NODE_PATH}/`
    : import.meta.url,
);
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CHROME =
  process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const PATHS = [
  "/",
  "/audits",
  "/audits/ab901-2025-Q4",
  "/contractors",
  "/contractors/ab901",
  "/findings",
  "/checklist",
  "/admin",
];
// 320 is the floor the project supports; 1440 is a desk.
const WIDTHS = [320, 360, 620, 860, 1100, 1440];
/** Text below this against its own background is a defect, not a style. */
const MIN_TEXT_CONTRAST = 4.5;

const srgb = (c) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) =>
  0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const parse = (css) => (css.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);

const failures = [];

const browser = await chromium.launch({ executablePath: CHROME });
const cookie = {
  name: "demo_profile",
  value: encodeURIComponent(JSON.stringify({ name: "check", role: "admin" })),
  domain: new URL(BASE).hostname,
  path: "/",
};

/* ---- 1 & 2: every page at every width ---- */
for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await ctx.addCookies([cookie]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    // A 404 on a favicon is not a broken page.
    if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()))
      errors.push(m.text());
  });

  for (const path of PATHS) {
    const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    if (res && res.status() >= 400) {
      failures.push(`${width}px ${path}: HTTP ${res.status()}`);
      continue;
    }
    const over = await page.evaluate(() => {
      const d = document.documentElement;
      if (d.scrollWidth <= window.innerWidth + 1) return null;
      const culprits = [...document.querySelectorAll("*")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return (
            r.right > window.innerWidth + 1 &&
            r.width > 0 &&
            cs.overflowX !== "auto" &&
            cs.overflowX !== "scroll"
          );
        })
        .slice(0, 3)
        .map((el) => el.className?.baseVal ?? el.className ?? el.tagName);
      return { scrollWidth: d.scrollWidth, inner: window.innerWidth, culprits };
    });
    if (over) {
      failures.push(
        `${width}px ${path}: scrolls sideways ${over.scrollWidth} > ${over.inner} — ${over.culprits.join(", ")}`,
      );
    }
  }
  if (errors.length) {
    failures.push(`${width}px: console/page errors — ${[...new Set(errors)].slice(0, 3).join(" | ")}`);
  }
  await ctx.close();
}

/* ---- 3: print contrast ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.addCookies([cookie]);
  const page = await ctx.newPage();
  for (const path of ["/", "/contractors/ab901", "/audits/ab901-2025-Q4"]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await page.emulateMedia({ media: "print" });
    await page.waitForTimeout(200);
    const samples = await page.evaluate(() => {
      const out = [];
      const seen = new Set();
      for (const el of document.querySelectorAll(
        "h1, h2, h3, p, td, th, strong, b, .panel-score, .bn-stat-value",
      )) {
        if (out.length >= 40) break;
        const text = el.textContent?.trim() ?? "";
        if (!text || text.length > 60 || seen.has(text)) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        seen.add(text);
        // Walk up for the nearest painted background.
        let bg = "rgba(0, 0, 0, 0)";
        for (let n = el; n; n = n.parentElement) {
          const c = getComputedStyle(n).backgroundColor;
          if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) {
            bg = c;
            break;
          }
        }
        out.push({ text: text.slice(0, 30), color: getComputedStyle(el).color, bg });
      }
      return out;
    });
    for (const s of samples) {
      const fg = parse(s.color);
      const bg = parse(s.bg);
      if (fg.length < 3 || bg.length < 3) continue;
      const ratio = contrast(fg, bg);
      if (ratio < MIN_TEXT_CONTRAST) {
        failures.push(
          `print ${path}: "${s.text}" at ${ratio.toFixed(2)}:1 (${s.color} on ${s.bg})`,
        );
      }
    }
  }
  await ctx.close();
}

await browser.close();

if (failures.length) {
  console.error(`FAIL — ${failures.length} problem(s):`);
  for (const f of failures.slice(0, 30)) console.error("  ", f);
  process.exit(1);
}
console.log(
  `PASS — ${PATHS.length} pages × ${WIDTHS.length} widths: no sideways scroll, no page errors; print text clears ${MIN_TEXT_CONTRAST}:1`,
);
