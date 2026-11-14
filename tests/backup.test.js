// Backup file: saving, restoring on another device, and refusing bad files safely.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium, entry, openTracker, savedEntries, saved, answerDialogs, newContext, TRACKER } = require("./helpers");

let browser, dir;
before(async () => { browser = await chromium.launch(); dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccwt-backup-")); });
after(async () => { await browser.close(); });

const writeFile = (name, data) => { const f = path.join(dir, name); fs.writeFileSync(f, typeof data === "string" ? data : JSON.stringify(data)); return f; };
const restore = async (p, file, waitFor = /Added|not a backup|no entries|Could not/) => {
  // Clear the last message first, so the wait below cannot pick up the previous restore's result.
  await p.evaluate(() => { document.getElementById("backupMsg").textContent = ""; });
  await p.setInputFiles("#backupFile", file);
  await p.waitForFunction((re) => new RegExp(re).test(document.getElementById("backupMsg").textContent), waitFor.source);
  return p.textContent("#backupMsg");
};

test("save on one device, restore on another: entries merge, repeats are skipped", async () => {
  const mine = [entry("2026-11-02T10:00"), entry("2026-11-03T11:00", { label: "Prior auth" }), entry("2026-11-04T09:00", { label: "Scheduling" })];
  const A = await openTracker(browser, { storage: { entries: mine } });
  assert.ok(await A.isVisible("#safe.due"), "reminds her when entries have never been backed up");
  assert.match(await A.textContent("#safeText"), /3 entries are only in this browser/);
  await A.click("#tab-buttons"); await A.fill("#bLabel", "Equipment letters"); await A.click("#bAdd");
  const [dl] = await Promise.all([A.waitForEvent("download"), A.click("#safeSave")]);
  assert.equal(dl.suggestedFilename(), "complex-care-work-backup_2026-11-11.json");
  assert.ok(!(await A.isVisible("#safe.due")));
  assert.equal(await A.textContent("#safeText"), "Everything is backed up. Last backup today.");
  assert.ok(await A.isVisible("#backupPanel"), "the panel opens to say where to keep the file");
  assert.match(await A.textContent("#backupMsg"), /Saved backup file with 3 entries/);
  assert.match(await A.textContent("#lastBackup"), /today/);
  const file = path.join(dir, dl.suggestedFilename()); await dl.saveAs(file);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(data.entries.length, 3);
  assert.ok(data.buttons.some((b) => b.label === "Equipment letters"));

  const B = await openTracker(browser, { storage: { entries: [entry("2026-11-11T09:00", { label: "Own entry" })] } });
  await B.click("#tab-entries");
  const seen = answerDialogs(B, [true]);
  assert.equal(await restore(B, file), "Added 3 entries. Buttons updated from the backup.");
  assert.match(seen[0], /own task buttons/);
  assert.equal((await savedEntries(B)).length, 4);
  assert.equal(await restore(B, file, /already here/), "Added 0 entries. 3 were already here.");
  assert.equal((await savedEntries(B)).length, 4);
});

test("files that are not backups are refused with a message and nothing changes", async () => {
  const p = await openTracker(browser, { storage: { entries: [entry("2026-11-11T09:00")] } });
  await p.click("#tab-entries");
  assert.match(await restore(p, writeFile("bad.json", "not json")), /not a backup/);
  assert.match(await restore(p, writeFile("empty.json", { hello: 1 })), /no entries/);
  assert.equal((await savedEntries(p)).length, 1);
});

test("bad items inside a backup are skipped, and a broken button list does not stop the restore", async () => {
  const p = await openTracker(browser);
  await p.click("#tab-entries");
  const file = writeFile("mixed.json", { entries: [entry("2026-11-10T10:00"), { label: "", minutes: 5 }, { label: "X", date: "nonsense", minutes: 5 }],
    buttons: [null, { label: "Equipment letters", clinic: "Complex Care", who: "MA" }] });
  answerDialogs(p, [false]);
  assert.equal(await restore(p, file), "Added 1 entry. 2 could not be read and were skipped.");
  assert.equal(await saved(p, "buttons"), null, "declining keeps the current buttons");
});

test("a huge id in a backup does not make later entries share an id", async () => {
  const p = await openTracker(browser);
  await p.click("#tab-entries");
  await restore(p, writeFile("huge.json", { entries: [entry("2026-11-10T10:00", { id: 1e17 })] }));
  await p.click("#addBox summary");
  for (const l of ["A", "B"]) { await p.fill("#mLabel", l); await p.fill("#mMinutes", "3"); await p.click("#mAdd"); }
  const ids = (await savedEntries(p)).map((e) => e.id);
  assert.equal(new Set(ids).size, 3);
  assert.ok(ids.every(Number.isSafeInteger));
});

test("text inside a restored backup is shown as text", async () => {
  const evil = '<img src=x onerror="window.pwned=1">';
  const p = await openTracker(browser);
  await p.click("#tab-entries");
  await restore(p, writeFile("evil.json", { entries: [entry("2026-11-11T09:00", { label: evil, note: evil, who: evil, source: evil, clinic: evil })] }));
  await p.click(".e-edit");
  for (const tab of ["#tab-report", "#tab-track"]) await p.click(tab);
  assert.equal(await p.evaluate(() => window.pwned), undefined);
  assert.equal(await p.locator("main img").count(), 0);
});

test("status line: counts work not in a backup, and turns amber once it is 2 days old", async () => {
  const at = (t) => Date.parse(t + "-08:00");
  const lastBackup = String(at("2026-11-03T10:00"));
  // Backed up, then one entry added the next day: amber, with the count.
  const p = await openTracker(browser, { storage: { lastBackup,
    entries: [entry("2026-11-02T10:00", { id: at("2026-11-02T10:30") }), entry("2026-11-04T10:00", { id: at("2026-11-04T10:30") })] } });
  assert.ok(await p.isVisible("#safe.due"));
  assert.equal(await p.textContent("#safeText"), "1 entry not in a backup yet. Last backup 8 days ago.");
  // Everything older than the last backup: calm, even though the backup is old.
  const ok = await openTracker(browser, { storage: { lastBackup, entries: [entry("2026-11-02T10:00", { id: at("2026-11-02T10:30") })] } });
  assert.ok(!(await ok.isVisible("#safe.due")));
  assert.equal(await ok.textContent("#safeText"), "Everything is backed up. Last backup 8 days ago.");
  // Added today and not backed up: said plainly, but not amber yet.
  const today = await openTracker(browser, { storage: { lastBackup, entries: [entry("2026-11-11T09:00", { id: at("2026-11-11T09:30") })] } });
  assert.ok(!(await today.isVisible("#safe.due")));
  assert.match(await today.textContent("#safeText"), /^1 entry not in a backup yet/);
  // A brand-new browser offers a restore, and the panel opens from every tab.
  const fresh = await openTracker(browser);
  assert.ok(!(await fresh.isVisible("#safe.due")));
  assert.equal(await fresh.textContent("#safeMore"), "Restore from a backup file");
  await fresh.click("#tab-report"); await fresh.click("#safeMore");
  assert.ok(await fresh.isVisible("#backupPanel"));
  assert.ok(await fresh.isDisabled("#backupSave"), "nothing to save yet");
  await fresh.click("#bpClose");
  assert.ok(!(await fresh.isVisible("#backupPanel")));
});

test("restoring onto a new device counts as backed up; extra local entries still count as not backed up", async () => {
  const file = writeFile("full.json", { savedAt: "2026-11-10T18:00:00.000Z",
    entries: [entry("2026-11-09T10:00", { id: Date.parse("2026-11-09T10:30:00-08:00") })] });
  const p = await openTracker(browser);
  await restore(p, file);
  assert.equal(await p.textContent("#safeText"), "Everything is backed up. Last backup yesterday.");
  const q = await openTracker(browser, { storage: { entries: [entry("2026-11-11T09:00", { id: Date.parse("2026-11-11T09:30:00-08:00") })] } });
  await restore(q, file);
  assert.match(await q.textContent("#safeText"), /2 entries are only in this browser/);
});

test("restore keeps whichever copy of an entry was edited more recently", async () => {
  const original = entry("2026-11-10T10:00", { label: "Forms", minutes: 30 });
  // This device edited the entry; the backup holds an older edit of the same entry.
  const p = await openTracker(browser, { storage: { entries: [{ ...original, minutes: 45, updatedAt: Date.parse("2026-11-11T09:00:00-08:00") }] } });
  await p.click("#tab-entries");
  const older = writeFile("older.json", { entries: [{ ...original, minutes: 35, updatedAt: Date.parse("2026-11-10T12:00:00-08:00") }] });
  assert.equal(await restore(p, older), "Added 0 entries. 1 was already here.");
  assert.equal((await savedEntries(p))[0].minutes, 45, "the newer local edit is kept");

  const newer = writeFile("newer.json", { entries: [{ ...original, minutes: 60, note: "Batch", updatedAt: Date.parse("2026-11-11T09:30:00-08:00") }] });
  assert.equal(await restore(p, newer), "Added 0 entries. Updated 1 that was edited more recently in the backup.");
  const [e] = await savedEntries(p);
  assert.deepEqual([e.minutes, e.note], [60, "Batch"]);

  const unedited = writeFile("unedited.json", { entries: [original] });
  assert.match(await restore(p, unedited), /1 was already here/, "a never-edited copy does not replace an edited one");
  assert.equal((await savedEntries(p))[0].minutes, 60);
});

test("editing an entry records when it was edited", async () => {
  const p = await openTracker(browser, { storage: { entries: [entry("2026-11-10T10:00")] } });
  await p.click("#tab-entries");
  await p.click(".e-edit");
  const min = p.locator(".editor input[type=number]");
  await min.fill("40"); await min.dispatchEvent("change");
  const [e] = await savedEntries(p);
  const t0 = Date.parse("2026-11-11T10:00:00-08:00"); // the test clock starts here and keeps ticking
  assert.ok(e.updatedAt >= t0 && e.updatedAt < t0 + 60e3, `updatedAt ${e.updatedAt} is the time of the edit`);
});

test("a save that fails while the page opens shows the backup panel instead of breaking the page", async () => {
  const ctx = await newContext(browser);
  // Storage refuses to save entries once "fail" is set.
  await ctx.addInitScript(() => { const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (k === "ccwt_entries_v1" && this.getItem("fail") === "1") throw new DOMException("full", "QuotaExceededError"); return real.call(this, k, v); }; });
  const e = entry("2026-11-10T10:00");
  const page = await ctx.newPage(); page.errors = []; page.on("pageerror", (x) => page.errors.push(x.message));
  await page.goto(TRACKER);
  // A repeated id is repaired as the page opens, so the page saves straight away, and that save fails.
  await page.evaluate((list) => { localStorage.setItem("ccwt_entries_v1", JSON.stringify(list)); localStorage.setItem("fail", "1"); }, [e, { ...e }]);
  const seen = answerDialogs(page, [true]);
  await page.reload();
  await page.waitForSelector("#backupPanel[open]");
  assert.match(seen[0], /would not save/);
  assert.ok((await page.locator(".tile").count()) > 0, "task buttons are drawn");
  assert.deepEqual(page.errors, []);
});

test("persistent storage: asked once there are entries, not again on later visits, and on every Save backup file", async () => {
  const ctx = await newContext(browser);
  await ctx.addInitScript(() => { window.__asks = 0;
    Object.defineProperty(navigator, "storage", { value: { persisted: async () => false, persist: async () => { window.__asks++; return false; } } }); });
  const p = await openTracker(browser, { context: ctx });
  await p.click(".tile >> text=Forms"); await p.click(".tile >> text=Scheduling"); await p.click("#stop");
  await p.waitForFunction(() => window.__asks === 1);
  await p.reload(); // the count starts again at 0 on each page load
  await p.click(".tile >> text=Forms"); await p.click("#stop");
  assert.equal(await p.evaluate(() => window.__asks), 0, "not asked again on the next visit");
  await p.click("#safeMore");
  await Promise.all([p.waitForEvent("download"), p.click("#backupSave")]);
  assert.equal(await p.evaluate(() => window.__asks), 1, "Save backup file always asks");
});

test("restoring an older copy of an entry edited here does not count as backed up", async () => {
  const at = (t) => Date.parse(t + "-08:00");
  const original = entry("2026-11-09T10:00", { id: at("2026-11-09T10:30") });
  const p = await openTracker(browser, { storage: { entries: [{ ...original, minutes: 45, updatedAt: at("2026-11-10T09:00") }] } });
  const file = writeFile("stale.json", { savedAt: new Date(at("2026-11-10T18:00")).toISOString(), entries: [original] });
  await restore(p, file);
  assert.match(await p.textContent("#safeText"), /only in this browser/);
});

test("button changes after a backup are counted as not backed up", async () => {
  const p = await openTracker(browser, { storage: { lastBackup: String(Date.parse("2026-11-10T18:00:00-08:00")) } });
  await p.click("#tab-buttons"); await p.fill("#bLabel", "Equipment letters"); await p.click("#bAdd");
  assert.equal(await p.textContent("#safeText"), "Button changes not in a backup yet. Last backup yesterday.");
  assert.ok(await p.isEnabled("#backupSave"), "buttons alone can be backed up");
  const q = await openTracker(browser, { storage: { lastBackup: String(Date.parse("2026-11-10T18:00:00-08:00")),
    entries: [entry("2026-11-11T09:00", { id: Date.parse("2026-11-11T09:30:00-08:00") })] } });
  await q.click("#tab-buttons"); await q.fill("#bLabel", "Equipment letters"); await q.click("#bAdd");
  assert.equal(await q.textContent("#safeText"), "1 entry and button changes not in a backup yet. Last backup yesterday.");
});

test("backup panel: Save has focus, and a tap outside closes it", async () => {
  const p = await openTracker(browser, { storage: { entries: [entry("2026-11-10T10:00")] } });
  await p.click("#safeMore");
  assert.equal(await p.evaluate(() => document.activeElement.id), "backupSave");
  await p.mouse.click(5, 5);
  assert.ok(!(await p.isVisible("#backupPanel")));
});
