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

// Line endings are made "\n" so the edits below match on a Windows checkout too (Git may check out "\r\n").
const original = fs.readFileSync(path.join(__dirname, "..", "tracker.html"), "utf8").replace(/\r\n/g, "\n");
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
    ["const RENAMES = {\n", 'const RENAMES = { "Clerical / admin": "Front desk",\n'],
  ]);
  const p = await openTracker(browser, { url, storage: {
    entries: oldEntries(),
    buttons: [{ label: "Forms", clinic: "Complex Care", facing: false, who: "Clerical / admin" }, { label: "Extra", clinic: "Complex Care", facing: false, who: "MA" }],
    running: { label: "Forms", clinic: "Complex Care", facing: false, who: "Clerical / admin", startedAt: Date.parse("2026-11-11T09:55:00-08:00") },
  } });
  assert.ok(!(await p.isVisible("#setupWarn")), "no warning after a proper rename");
  await p.click("#stop");
  assert.equal(await p.locator(".tile", { hasText: "Forms" }).locator(".t-meta").textContent(), "Front desk");
  const who = (await savedEntries(p)).map((e) => e.who);
  assert.ok(!who.includes("Clerical / admin"));
  assert.equal(who.filter((w) => w === "Front desk").length, 2, "the old entry and the timed one");
  assert.equal((await saved(p, "buttons"))[0].who, "Front desk");
  await p.click("#tab-report"); await p.click('#presets [data-range="week"]');
  assert.match(await p.textContent("#splitLegend"), /Front desk: 0\.6 h/);
  assert.match(await p.textContent("#summaryText"), /35 min clerical/, "still counted as clerical (30 min saved + 5 min timed)");
});

test("renaming the physician role without a RENAMES line is flagged, not silently miscounted", async () => {
  const url = editedTracker([['const PHYSICIAN   = "Physician or PA";', 'const PHYSICIAN   = "Physician only";']]);
  const p = await openTracker(browser, { url, storage: { entries: oldEntries() } });
  assert.ok(await p.isVisible("#setupWarn"));
  assert.match(await p.textContent("#setupWarn"), /1 saved entry still uses "Physician or PA", the old name of PHYSICIAN \(now "Physician only"\)\. Add this line to RENAMES: "Physician or PA": "Physician only"/);
});

test("entries saved as 'Only a physician' by an earlier version become 'Physician or PA' and still count as clinician work", async () => {
  const p = await openTracker(browser, { storage: { entries: oldEntries() } });
  assert.ok(!(await p.isVisible("#setupWarn")));
  assert.deepEqual((await savedEntries(p)).map((e) => e.who), ["Physician or PA", "Clerical / admin", "Care coordinator"]);
  await p.click("#tab-report"); await p.click('#presets [data-range="week"]');
  assert.match(await p.textContent("#splitLegend"), /Needs a physician or PA: 1\.0 h/);
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

// ---- Follow-up from the PR #2 review ----

const summaryFact = async (p, label) => {
  await p.click("#tab-report"); await p.click('#presets [data-range="week"]');
  return (await p.textContent("#summary")).match(new RegExp(label + "([\\d.]+ h)"))[1];
};

test("renaming the clinic without a RENAMES line is flagged; with one, the work stays complex care", async () => {
  const bad = editedTracker([['const COMPLEX     = "Complex Care";', 'const COMPLEX     = "Complex care clinic";']]);
  let p = await openTracker(browser, { url: bad, storage: { entries: oldEntries() } });
  assert.match(await p.textContent("#setupWarn"), /3 saved entries still use "Complex Care", the old name of COMPLEX/);
  const good = editedTracker([['const COMPLEX     = "Complex Care";', 'const COMPLEX     = "Complex care clinic";'],
    ["const RENAMES = {\n", 'const RENAMES = { "Complex Care": "Complex care clinic",\n']]);
  p = await openTracker(browser, { url: good, storage: { entries: oldEntries() } });
  assert.ok(!(await p.isVisible("#setupWarn")));
  assert.equal(await summaryFact(p, "Healthy urgents assigned on top"), "0 h");
});

test("buttons changed on the page and a running timer under an old name are flagged", async () => {
  const url = editedTracker([['const COMPLEX     = "Complex Care";', 'const COMPLEX     = "Complex care clinic";']]);
  const p = await openTracker(browser, { url, storage: {
    buttons: [{ label: "Forms", clinic: "Complex Care", facing: false, who: "MA" }],
    running: { label: "Forms", clinic: "Complex Care", facing: false, who: "MA", startedAt: Date.parse("2026-11-11T09:55:00-08:00") } } });
  assert.match(await p.textContent("#setupWarn"), /1 button changed on the page, the running timer still use "Complex Care", the old name of COMPLEX/);
});

test("removing a role that is not a key name does not raise a warning, and its entries still count", async () => {
  const url = editedTracker([['SOCIAL, "Pharmacist",', 'SOCIAL,']]);
  const p = await openTracker(browser, { url, storage: { entries: [entry("2026-11-10T10:00", { who: "Pharmacist", minutes: 30 })] } });
  assert.ok(!(await p.isVisible("#setupWarn")));
  await p.click("#tab-report"); await p.click('#presets [data-range="week"]');
  assert.match(await p.textContent("#splitLegend"), /Other support roles: 30 min/);
});

test("removing CLERICAL or COORDINATOR from the list is flagged", async () => {
  const url = editedTracker([["const WHO_OPTIONS = [PHYSICIAN, CLERICAL, COORDINATOR, ", "const WHO_OPTIONS = [PHYSICIAN, "]]);
  const text = await (await openTracker(browser, { url })).textContent("#setupWarn");
  assert.match(text, /WHO_OPTIONS does not include CLERICAL/);
  assert.match(text, /WHO_OPTIONS does not include COORDINATOR/);
});

test("chained renames are followed to the end", async () => {
  const url = editedTracker([['const CLERICAL    = "Clerical / admin";', 'const CLERICAL    = "Clerk";'],
    ["const RENAMES = {\n", 'const RENAMES = { "Clerical / admin": "Front desk", "Front desk": "Clerk",\n']]);
  const p = await openTracker(browser, { url, storage: { entries: [entry("2026-11-10T10:00"), entry("2026-11-10T11:00", { who: "Front desk" })] } });
  assert.ok(!(await p.isVisible("#setupWarn")));
  assert.deepEqual((await savedEntries(p)).map((e) => e.who), ["Clerk", "Clerk"]);
  await p.click("#tab-report"); await p.click('#presets [data-range="week"]');
  assert.match(await p.textContent("#summaryText"), /1\.0 h clerical/);
});

test("a RENAMES loop or a rename to a name not in the lists is flagged, and does not hang", async () => {
  const url = editedTracker([["const RENAMES = {\n", 'const RENAMES = { "MA": "Medical assistant", "A": "B", "B": "A",\n']]);
  const text = await (await openTracker(browser, { url })).textContent("#setupWarn");
  assert.match(text, /RENAMES changes "MA" to "Medical assistant", which is not in WHO_OPTIONS or CLINICS/);
  assert.match(text, /RENAMES changes "A" to "B"/);
});

test("renamed values are saved straight away, so removing the RENAMES line later is safe", async () => {
  const renamedUrl = editedTracker([['const CLERICAL    = "Clerical / admin";', 'const CLERICAL    = "Front desk";'],
    ["const RENAMES = {\n", 'const RENAMES = { "Clerical / admin": "Front desk",\n']]);
  const p = await openTracker(browser, { url: renamedUrl, storage: { entries: [entry("2026-11-10T10:00")] } });
  assert.deepEqual((await savedEntries(p)).map((e) => e.who), ["Front desk"], "saved on load, before any tap");
  const later = editedTracker([['const CLERICAL    = "Clerical / admin";', 'const CLERICAL    = "Front desk";']]);
  await p.goto(later);
  assert.ok(!(await p.isVisible("#setupWarn")));
});

test("key names containing quotes or angle brackets display correctly", async () => {
  const url = editedTracker([['const CLERICAL    = "Clerical / admin";', 'const CLERICAL    = "Clerk \\"front\\" <desk>";'],
    ["const RENAMES = {\n", 'const RENAMES = { "Clerical / admin": "Clerk \\"front\\" <desk>",\n']]);
  const p = await openTracker(browser, { url, storage: { entries: [entry("2026-11-10T10:00")] } });
  await p.click("#tab-report"); await p.click('#presets [data-range="week"]');
  assert.match(await p.textContent("#splitLegend"), /Clerk "front" <desk>: 30 min/);
  assert.equal(await p.locator("#splitBar span").first().getAttribute("title"), 'Clerk "front" <desk>: 30 min');
  await p.click("#tab-track");
  assert.match(await p.textContent("#stripLegend"), /Clerk "front" <desk> could do it/);
  assert.deepEqual(p.errors, []);
});

test("renaming SOCIAL carries social work over, and the summary uses the new name mid-sentence", async () => {
  const url = editedTracker([['const SOCIAL      = "Social work";', 'const SOCIAL      = "Medical social work";'],
    ["const RENAMES = {\n", 'const RENAMES = { "Social work": "Medical social work",\n']]);
  const p = await openTracker(browser, { url, storage: { entries: [entry("2026-11-10T10:00", { label: "Community resources", who: "Social work", minutes: 30 })] } });
  assert.ok(!(await p.isVisible("#setupWarn")));
  await p.click("#tab-report"); await p.click('#presets [data-range="week"]');
  assert.match(await p.textContent("#splitLegend"), /Medical social work: 30 min/);
  assert.match(await p.textContent("#summaryText"), /30 min medical social work and 0 h clerical\..*It needs dedicated nursing, care-coordination, medical social work and clerical support\./);
});
