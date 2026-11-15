// Shared helpers for the browser tests. Every test opens tracker.html in headless Chromium
// with a fake clock fixed to a known Wednesday morning in Pacific time, so results do not
// depend on when or where the tests run.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const TRACKER = "file://" + path.resolve(__dirname, "..", "tracker.html");
const TZ = "America/Los_Angeles";
const NOW = "2026-11-11T10:00:00-08:00"; // Wednesday, inside clinic hours (8am to 5pm)

const KEYS = { entries: "ccwt_entries_v1", buttons: "ccwt_buttons_v1", running: "ccwt_running_v1",
  range: "ccwt_range_v1", lastBackup: "ccwt_last_backup_v1" };

let nextId = 1762000000000;
// A saved entry in the shape tracker.html stores. `at` is a local Pacific time like "2026-11-10T21:00".
function entry(at, fields = {}) {
  return { id: nextId++, date: new Date(at + "-08:00").toISOString(), label: "Forms", clinic: "Complex Care",
    facing: false, who: "Clerical / admin", minutes: 30, note: "", ...fields };
}

async function newContext(browser, { now = NOW } = {}) {
  const ctx = await browser.newContext({ timezoneId: TZ, acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  if (now) await ctx.clock.install({ time: new Date(now) });
  return ctx;
}

// Open the tracker. `storage` maps localStorage keys (short names from KEYS, or full keys) to values.
async function openTracker(browser, { now = NOW, storage, context, url = TRACKER, viewport } = {}) {
  const ctx = context || (await newContext(browser, { now }));
  const page = await ctx.newPage();
  if (viewport) await page.setViewportSize(viewport);
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(url);
  if (storage) {
    await page.evaluate((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); },
      Object.fromEntries(Object.entries(storage).map(([k, v]) => [KEYS[k] || k, v])));
    await page.reload();
  }
  return page;
}

const saved = (page, key = "entries") => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), KEYS[key] || key);
const savedEntries = async (page) => (await saved(page, "entries")) || [];

// Answer the next dialogs (prompt/confirm) in order: a string accepts with that text, true accepts, null/false dismisses.
function answerDialogs(page, answers) {
  const seen = [];
  const handler = async (d) => {
    seen.push(d.message());
    const a = answers.shift();
    if (answers.length === 0) page.off("dialog", handler);
    if (a === null || a === false) await d.dismiss(); else await d.accept(a === true ? undefined : a);
  };
  page.on("dialog", handler);
  return seen;
}

// A copy of tracker.html with some lines changed, the way she would edit the settings. `edits` is a list of
// [from, to] pairs. Line endings are made "\n" so the edits match on a Windows checkout too (Git may check out "\r\n").
function editedTracker(edits) {
  let src = fs.readFileSync(path.join(__dirname, "..", "tracker.html"), "utf8").replace(/\r\n/g, "\n");
  for (const [from, to] of edits) { if (!src.includes(from)) throw new Error(`not found: ${from}`); src = src.replace(from, to); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccwt-settings-"));
  fs.writeFileSync(path.join(dir, "tracker.html"), src);
  return "file://" + path.join(dir, "tracker.html");
}

module.exports = { chromium, TRACKER, TZ, NOW, KEYS, entry, newContext, openTracker, saved, savedEntries, answerDialogs, editedTracker };
