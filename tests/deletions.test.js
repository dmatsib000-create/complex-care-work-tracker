// Deleted entries stay deleted: restoring a backup does not bring them back, deletions travel in backup files,
// and a later edit beats an earlier deletion. Also: backups from another app or a newer version are refused.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium, entry, openTracker, savedEntries, saved, answerDialogs } = require("./helpers");

let browser, dir;
before(async () => { browser = await chromium.launch(); dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccwt-deleted-")); });
after(async () => { await browser.close(); });

const at = (t) => Date.parse(t + "-08:00"); // a local Pacific time, as ms
const YESTERDAY_EVENING = String(at("2026-11-10T18:00"));
const writeFile = (name, data) => { const f = path.join(dir, name); fs.writeFileSync(f, JSON.stringify(data)); return f; };
const restore = async (p, file, waitFor = /Added|not a backup|no entries|Could not|newer version/) => {
  await p.evaluate(() => { document.getElementById("backupMsg").textContent = ""; });
  await p.setInputFiles("#backupFile", file);
  await p.waitForFunction((re) => new RegExp(re).test(document.getElementById("backupMsg").textContent), waitFor.source);
  return p.textContent("#backupMsg");
};
const deleteFirstEntry = async (p) => {
  await p.click("#tab-entries"); await p.click(".e-edit");
  answerDialogs(p, [true]); await p.click(".editor .btn.danger");
};

test("a deleted entry is not brought back by restoring a backup that still has it", async () => {
  const forms = entry("2026-11-09T10:00");
  const p = await openTracker(browser, { storage: { entries: [forms], lastBackup: YESTERDAY_EVENING } });
  const old = writeFile("old.json", { savedAt: new Date(at("2026-11-10T18:00")).toISOString(), entries: [forms] });
  await deleteFirstEntry(p);
  assert.deepEqual(Object.keys(await saved(p, "ccwt_deleted_v1")), [String(forms.id)], "the deletion is recorded");
  assert.equal(await p.textContent("#safeText"), "1 deletion not in a backup yet. Last backup yesterday.");

  assert.equal(await restore(p, old), "Added 0 entries. 1 deleted entry was not brought back.");
  assert.equal((await savedEntries(p)).length, 0);
  assert.match(await p.textContent("#safeText"), /1 deletion not in a backup yet/, "an older backup does not cover the deletion");
});

test("deletions travel in backup files, and an older backup restored afterwards does not undo them", async () => {
  const forms = entry("2026-11-09T10:00"), auth = entry("2026-11-09T11:00", { label: "Prior auth" });
  const old = writeFile("before-delete.json", { savedAt: new Date(at("2026-11-10T18:00")).toISOString(), entries: [forms, auth] });

  // Each device's fake clock starts when it is opened, so the computer is opened first: otherwise the phone's
  // backup would look as if it was saved in the computer's future, and not count as a full backup there.
  const computer = await openTracker(browser, { storage: { entries: [forms, auth] } });
  // Phone: delete Prior auth, then save a backup. The file carries the deletion, and saving it clears the status.
  const phone = await openTracker(browser, { storage: { entries: [forms, auth], lastBackup: YESTERDAY_EVENING } });
  await deleteFirstEntry(phone); // newest first: Prior auth at 11:00
  await phone.click("#safeMore");
  const [dl] = await Promise.all([phone.waitForEvent("download"), phone.click("#backupSave")]);
  await phone.click("#bpClose");
  const file = path.join(dir, "after-delete.json"); await dl.saveAs(file);
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(file, "utf8")).deleted), [String(auth.id)]);
  assert.equal(await phone.textContent("#safeText"), "Everything is backed up. Last backup today.");

  // Computer: still has both. Restoring the phone's backup removes the deleted one here too.
  assert.equal(await restore(computer, file), "Added 0 entries. 1 was already here. Removed 1 that was deleted where the backup was made.");
  assert.deepEqual((await savedEntries(computer)).map((e) => e.label), ["Forms"]);
  assert.equal(await computer.textContent("#safeText"), "Everything is backed up. Last backup today.");
  // An older backup restored on the computer afterwards does not bring it back.
  assert.match(await restore(computer, old), /1 deleted entry was not brought back/);
  assert.deepEqual((await savedEntries(computer)).map((e) => e.label), ["Forms"]);
});

test("an edit made after the deletion beats it, and the spent deletion is dropped", async () => {
  const forms = entry("2026-11-09T10:00");
  const file = writeFile("deleted-at-8.json", { savedAt: new Date(at("2026-11-11T08:05")).toISOString(), entries: [],
    deleted: { [forms.id]: at("2026-11-11T08:00") } });
  const p = await openTracker(browser, { storage: { entries: [{ ...forms, minutes: 50, updatedAt: at("2026-11-11T09:00") }] } });
  assert.equal(await restore(p, file), "Added 0 entries.");
  assert.equal((await savedEntries(p))[0].minutes, 50, "edited here after it was deleted there, so it stays");
  assert.deepEqual(await saved(p, "ccwt_deleted_v1"), {});

  // The other way round: a copy edited before the deletion is removed.
  const q = await openTracker(browser, { storage: { entries: [{ ...forms, updatedAt: at("2026-11-11T07:00") }] } });
  assert.match(await restore(q, file), /Removed 1 that was deleted where the backup was made/);
  assert.equal((await savedEntries(q)).length, 0);
});

test("a deletion in another tab is picked up, so this tab does not save the entry back", async () => {
  const forms = entry("2026-11-09T10:00");
  const A = await openTracker(browser, { storage: { entries: [forms] } });
  const B = await A.context().newPage(); await B.goto(A.url());
  await deleteFirstEntry(A);
  await B.waitForFunction(() => document.getElementById("log").textContent.includes("No entries"));
  await B.click(".tile >> text=Scheduling"); await B.click("#stop");
  assert.deepEqual((await savedEntries(A)).map((e) => e.label), ["Scheduling"]);
  assert.deepEqual(Object.keys(await saved(B, "ccwt_deleted_v1")), [String(forms.id)]);
});

test("backups from another app or a newer version of the tracker are refused, on Restore and the Team tab", async () => {
  const p = await openTracker(browser, { storage: { entries: [entry("2026-11-11T09:00")] } });
  const other = writeFile("other-app.json", { app: "some-other-app", entries: [entry("2026-11-10T10:00")] });
  const newer = writeFile("newer.json", { app: "complex-care-work-tracker", format: 2, entries: [entry("2026-11-10T10:00")] });
  assert.match(await restore(p, other), /^That file is not a backup from this tracker/);
  assert.match(await restore(p, newer), /^That file was saved by a newer version of this tracker, so this copy cannot read it\./);
  assert.equal((await savedEntries(p)).length, 1, "nothing changed");

  await p.click("#tab-team");
  await p.setInputFiles("#teamFile", [other, newer]);
  await p.waitForFunction(() => document.getElementById("teamMsg").textContent.includes("newer version"));
  const msg = await p.textContent("#teamMsg");
  assert.match(msg, /other-app\.json is not a backup from this tracker/);
  assert.match(msg, /newer\.json was saved by a newer version/);
  assert.ok(await p.isVisible("#teamEmpty"), "no one was added");
});
