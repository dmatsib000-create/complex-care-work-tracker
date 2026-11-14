// The settings block: renaming a role or clinic, and the on-page check that catches settings mistakes.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium, entry, openTracker, savedEntries, saved } = require("./helpers");

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

const original = fs.readFileSync(path.join(__dirname, "..", "tracker.html"), "utf8");
// A copy of tracker.html with some settings lines changed, the way she would edit them.
function editedTracker(edits) {
  let src = original;
  for (const [from, to] of edits) { assert.ok(src.includes(from), `not found: ${from}`); src = src.replace(from, to); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccwt-settings-"));
  fs.writeFileSync(path.join(dir, "tracker.html"), src);
  return "file://" + path.join(dir, "tracker.html");
}
const oldEntries = () => [
  entry("2026-11-10T09:00", { label: "Complex visit", who: "Only a physician", minutes: 60 }),
  entry("2026-11-10T10:00", { label: "Forms", who: "Clerical / admin", minutes: 30 }),
  entry("2026-11-11T09:00", { label: "DME / supplies", who: "Care coordinator", minutes: 45 }),
];

test("the page as shipped shows no settings warning", async () => {
  const p = await openTracker(browser, { storage: { entries: oldEntries() } });
  assert.ok(!(await p.isVisible("#setupWarn")));
});

test("renaming a role with a RENAMES line carries old entries, buttons and a running timer over", async () => {
  const url = editedTracker([
    ['const CLERICAL    = "Clerical / admin";', 'const CLERICAL    = "Front desk";'],
    ["const RENAMES = {};", 'const RENAMES = { "Clerical / admin": "Front desk" };'],
  ]);
  const p = await openTracker(browser, { url, storage: {
    entries: oldEntries(),
    buttons: [{ label: "Forms", clinic: "Complex Care", facing: false, who: "Clerical / admin" }, { label: "Extra", clinic: "Complex Care", facing: false, who: "MA" }],
    running: { label: "Forms", clinic: "Complex Care", facing: false, who: "Clerical / admin", startedAt: Date.parse("2026-11-11T09:55:00-08:00") },
  } });
  assert.ok(!(await p.isVisible("#setupWarn")), "no warning after a proper rename");
  assert.equal(await p.textContent(".tile.active .t-meta"), "Front desk could do this");
  await p.click("#stop");
  const who = (await savedEntries(p)).map((e) => e.who);
  assert.ok(!who.includes("Clerical / admin"));
  assert.equal(who.filter((w) => w === "Front desk").length, 2, "the old entry and the timed one");
  assert.equal((await saved(p, "buttons"))[0].who, "Front desk");
  await p.click("#tab-report"); await p.click('#presets [data-range="week"]');
  assert.match(await p.textContent("#splitLegend"), /Front desk: 0\.6 h/);
  assert.match(await p.textContent("#summaryText"), /0\.6 h clerical/, "still counted as clerical (30 min saved + 5 min timed)");
});

test("renaming the physician role without a RENAMES line is flagged, not silently miscounted", async () => {
  const url = editedTracker([['const PHYSICIAN   = "Only a physician";', 'const PHYSICIAN   = "Physician only";']]);
  const p = await openTracker(browser, { url, storage: { entries: oldEntries() } });
  assert.ok(await p.isVisible("#setupWarn"));
  assert.match(await p.textContent("#setupWarn"), /1 saved entry uses the role "Only a physician", which is not in WHO_OPTIONS\. If it was renamed, add it to RENAMES/);
});

test("a task button with a role or clinic missing from the lists is flagged", async () => {
  const url = editedTracker([['{label:"Forms",clinic:COMPLEX,facing:false,who:CLERICAL}', '{label:"Forms",clinic:"Complex",facing:false,who:"Clerk"}']]);
  const p = await openTracker(browser, { url });
  const text = await p.textContent("#setupWarn");
  assert.match(text, /The "Forms" button uses a clinic that is not in CLINICS: "Complex"\./);
  assert.match(text, /The "Forms" button uses a role that is not in WHO_OPTIONS: "Clerk"\./);
});

test("removing the physician role from the list is flagged", async () => {
  const url = editedTracker([["const WHO_OPTIONS = [PHYSICIAN, ", "const WHO_OPTIONS = ["]]);
  const p = await openTracker(browser, { url });
  assert.match(await p.textContent("#setupWarn"), /WHO_OPTIONS does not include PHYSICIAN/);
});
