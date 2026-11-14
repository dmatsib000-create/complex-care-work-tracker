// The Entries tab and saved data: manual add, editing, deleting, older data, and damaged data.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium, entry, openTracker, savedEntries, answerDialogs } = require("./helpers");

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

const openAdd = async (p) => { await p.click("#tab-entries"); await p.click("#addBox summary"); };

test("manual add: backdated with a time, presets filled from the task name, after hours ticked", async () => {
  const p = await openTracker(browser);
  await openAdd(p);
  await p.fill("#mLabel", "DME / supplies"); await p.dispatchEvent("#mLabel", "change");
  assert.equal(await p.inputValue("#mWho"), "Care coordinator");
  await p.fill("#mMinutes", "40");
  await p.fill("#mDate", "2026-11-02"); await p.dispatchEvent("#mDate", "change");
  await p.fill("#mTime", "18:30"); await p.dispatchEvent("#mTime", "change");
  assert.ok(await p.isChecked("#mAfter"));
  await p.click("#mAdd");
  assert.match(await p.textContent("#mMsg"), /^Added DME \/ supplies, 40 min, on Mon, Nov 2\. It is outside the range shown\.$/);
  const [e] = await savedEntries(p);
  assert.equal(e.who, "Care coordinator");
  assert.equal(e.afterHours, true);
  assert.equal(e.timeUnknown, false);
  assert.equal(new Date(e.date).toISOString(), "2026-11-03T02:30:00.000Z");
});

test("manual add without a time: weekends count as after hours, and the entry shows 'No time'", async () => {
  const p = await openTracker(browser);
  await openAdd(p);
  await p.fill("#mDate", "2026-11-07"); await p.dispatchEvent("#mDate", "change"); // Saturday
  assert.ok(await p.isChecked("#mAfter"));
  await p.fill("#mLabel", "Forms"); await p.fill("#mMinutes", "10"); await p.click("#mAdd");
  assert.ok(await p.isChecked("#mAfter"), "still ticked for the next entry on the same day");
  const [e] = await savedEntries(p);
  assert.equal(e.timeUnknown, true);
  assert.equal(e.afterHours, true);
  await p.click('#presets [data-range="all"]');
  assert.equal(await p.textContent(".e-time"), "No time");
  await p.fill("#mDate", "2026-11-09"); await p.dispatchEvent("#mDate", "change"); // Monday
  assert.ok(!(await p.isChecked("#mAfter")));
});

test("manual add needs a task and minutes", async () => {
  const p = await openTracker(browser);
  await openAdd(p);
  await p.click("#mAdd");
  assert.equal(await p.textContent("#mMsg"), "Enter a task and the minutes it took.");
  assert.equal((await savedEntries(p)).length, 0);
});

test("every field of a saved entry can be edited; Done closes; Delete asks first", async () => {
  const p = await openTracker(browser, { storage: { entries: [entry("2026-11-10T10:00"), entry("2026-11-11T09:00", { label: "Scheduling" })] } });
  await p.click("#tab-entries");
  const row = p.locator(".entry", { hasText: "Forms" });
  await row.locator(".e-edit").click();
  const ed = row.locator(".editor");
  await ed.locator("select").nth(1).selectOption("Physician or PA");
  await ed.locator("input[type=number]").fill("55"); await ed.locator("input[type=number]").dispatchEvent("change");
  await ed.locator("select").nth(2).selectOption("Insurer");
  const note = ed.getByPlaceholder("e.g. School form batch"); await note.fill("Batch of school forms"); await note.dispatchEvent("change");
  await ed.locator("input[type=checkbox]").nth(2).check();
  let e = (await savedEntries(p)).find((x) => x.label === "Forms");
  assert.deepEqual([e.who, e.minutes, e.source, e.note, e.interrupted], ["Physician or PA", 55, "Insurer", "Batch of school forms", true]);
  await ed.locator("input[type=date]").fill("2026-11-09"); await ed.locator("input[type=date]").dispatchEvent("change");
  e = (await savedEntries(p)).find((x) => x.label === "Forms");
  assert.equal(new Date(e.date).toISOString(), "2026-11-09T18:00:00.000Z", "date changes keep the time of day");
  await p.locator(".editor >> text=Done").click();
  assert.equal(await p.locator(".editor").count(), 0);
  await p.locator(".entry", { hasText: "Scheduling" }).locator(".e-edit").click();
  answerDialogs(p, [false]); await p.click("text=Delete entry");
  assert.equal((await savedEntries(p)).length, 2, "dismissing the confirm keeps the entry");
  answerDialogs(p, [true]); await p.click("text=Delete entry");
  assert.deepEqual((await savedEntries(p)).map((x) => x.label), ["Forms"]);
});

test("entries saved by the older version load, and after hours is worked out for them", async () => {
  const old = [ // the shape saved before source/afterHours/interrupted existed
    { id: 1731300000000, date: new Date("2026-11-10T19:30:00-08:00").toISOString(), label: "Forms", clinic: "Complex Care", facing: false, who: "Clerical / admin", minutes: 60, note: "" },
    { id: 1731300000001, date: new Date("2026-11-10T10:00:00-08:00").toISOString(), label: "Prior auth", clinic: "Complex Care", facing: false, who: "Clerical / admin", minutes: 20, note: "" },
  ];
  const p = await openTracker(browser, { storage: { entries: old, running: { label: "Forms", clinic: "Complex Care", facing: false, who: "Clerical / admin", startedAt: Date.parse("2026-11-11T09:50:00-08:00") } } });
  assert.ok(await p.isVisible("#running"), "an old running timer resumes");
  await p.click("#tab-entries");
  const meta = await p.$$eval(".e-meta", (x) => x.map((y) => y.textContent));
  assert.ok(meta[0].includes("After hours"));
  assert.ok(!meta[1].includes("After hours"));
  assert.deepEqual(p.errors, []);
});

test("damaged saved data does not stop the page, and is kept aside", async () => {
  const p = await openTracker(browser, { storage: { entries: "{broken", running: "nope", buttons: "[1,2" } });
  assert.equal(await p.locator(".tile").count(), 20);
  assert.deepEqual(p.errors, []);
  const kept = await p.evaluate(() => Object.keys(localStorage).filter((k) => k.includes("_unreadable_")).length);
  assert.equal(kept, 3);
});

test("duplicate or unsafe ids are repaired on load, so one delete removes one entry", async () => {
  const p = await openTracker(browser, { storage: { entries: [
    entry("2026-11-11T08:00", { id: 1e17, label: "A" }), entry("2026-11-11T08:30", { id: 1e17, label: "B" }),
    entry("2026-11-11T09:00", { id: 5, label: "C" }), entry("2026-11-11T09:30", { id: 5, label: "D" }) ] } });
  const ids = (await savedEntries(p)).map((e) => e.id);
  assert.equal(new Set(ids).size, 4);
  assert.ok(ids.every(Number.isSafeInteger));
  await p.click("#tab-entries");
  await p.locator(".entry", { hasText: "B" }).locator(".e-edit").click();
  answerDialogs(p, [true]); await p.click("text=Delete entry");
  assert.deepEqual((await savedEntries(p)).map((e) => e.label).sort(), ["A", "C", "D"]);
});
