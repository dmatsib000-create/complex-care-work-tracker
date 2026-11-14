// Backup file: saving, restoring on another device, and refusing bad files safely.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium, entry, openTracker, savedEntries, saved, answerDialogs } = require("./helpers");

let browser, dir;
before(async () => { browser = await chromium.launch(); dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccwt-backup-")); });
after(async () => { await browser.close(); });

const writeFile = (name, data) => { const f = path.join(dir, name); fs.writeFileSync(f, typeof data === "string" ? data : JSON.stringify(data)); return f; };
const restore = async (p, file, waitFor = /Added|not a backup|no entries|Could not/) => {
  await p.setInputFiles("#backupFile", file);
  await p.waitForFunction((re) => new RegExp(re).test(document.getElementById("backupMsg").textContent), waitFor.source);
  return p.textContent("#backupMsg");
};

test("save on one device, restore on another: entries merge, repeats are skipped", async () => {
  const mine = [entry("2026-11-02T10:00"), entry("2026-11-03T11:00", { label: "Prior auth" }), entry("2026-11-04T09:00", { label: "Scheduling" })];
  const A = await openTracker(browser, { storage: { entries: mine } });
  assert.ok(await A.isVisible("#nudge"), "reminds her when entries have never been backed up");
  await A.click("#tab-buttons"); await A.fill("#bLabel", "Equipment letters"); await A.click("#bAdd");
  const [dl] = await Promise.all([A.waitForEvent("download"), A.click("#nudgeSave")]);
  assert.equal(dl.suggestedFilename(), "complex-care-work-backup_2026-11-11.json");
  assert.ok(!(await A.isVisible("#nudge")));
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

test("reminder: shown when the last backup is a week old, not for a brand-new user", async () => {
  const p = await openTracker(browser, { storage: { entries: [entry("2026-11-10T10:00")], lastBackup: String(Date.parse("2026-11-03T10:00:00-08:00")) } });
  assert.ok(await p.isVisible("#nudge"));
  assert.match(await p.textContent("#nudgeText"), /8 days ago/);
  const fresh = await openTracker(browser);
  assert.ok(!(await fresh.isVisible("#nudge")));
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
