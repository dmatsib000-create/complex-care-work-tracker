// The Report tab: the numbers the case rests on, date ranges, and CSV export.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const { chromium, entry, openTracker } = require("./helpers");

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

const report = async (p, range) => { await p.click("#tab-report"); if (range) await p.click(`#presets [data-range="${range}"]`); };

test("support hours are per week across the range (6 h over 4 weeks = 1.5 h a week)", async () => {
  // First entry ever is before the range, so the whole 28 days count.
  const days = ["2026-10-01", "2026-10-16", "2026-10-21", "2026-10-28", "2026-11-02", "2026-11-05", "2026-11-10"];
  const p = await openTracker(browser, { storage: { entries: days.map((d) => entry(d + "T10:00", { minutes: 60 })) } });
  await report(p, "4w");
  assert.match(await p.textContent("#fte"), /1\.5 h a week of support work, about 0\.04 of a full-time support role/);
  assert.match(await p.textContent("#headline"), /^6\.0 h of 6\.0 h logged \(100%\) did not need a physician\.$/);
  assert.match(await p.textContent("#summaryText"), /about 1\.5 h a week of delegable work, roughly 0\.04 of a 40-hour support FTE/);
});

test("weeks are counted from the first day anything was logged, so early on the figure is not watered down", async () => {
  const p = await openTracker(browser, { storage: { entries: ["09", "10", "11"].map((d) => entry(`2026-11-${d}T10:00`, { minutes: 120 })) } });
  await report(p, "4w");
  assert.match(await p.textContent("#rangeLabel"), /Weekly figures count 3 days, from your first entry on/);
  assert.match(await p.textContent("#fte"), /You started logging on .*Once a full week has been logged/);
  await p.click('#presets [data-range="7d"]');
  assert.match(await p.textContent("#fte"), /You started logging on/);
});

test("a short range asks for 7 days or more instead of estimating", async () => {
  const p = await openTracker(browser, { storage: { entries: [entry("2026-10-01T10:00"), entry("2026-11-11T09:00")] } });
  await report(p, "today");
  assert.match(await p.textContent("#fte"), /Choose a range of 7 days or more/);
});

test("split by role, key figures, and support work by task", async () => {
  const p = await openTracker(browser, { storage: { entries: [
    entry("2026-11-09T09:00", { label: "Complex visit", who: "Only a physician", facing: true, minutes: 60 }),
    entry("2026-11-09T10:00", { label: "Forms", minutes: 30 }),
    entry("2026-11-10T11:00", { label: "DME / supplies", who: "Care coordinator", minutes: 50, interrupted: true }),
    entry("2026-11-10T18:00", { label: "Forms", minutes: 15, afterHours: true }),
    entry("2026-11-11T09:00", { label: "Healthy urgent visit", clinic: "Non-complex Healthy Urgent", who: "Only a physician", facing: true, minutes: 30 }),
  ] } });
  await report(p, "week");
  assert.equal(await p.locator("#splitBar span").count(), 3);
  const facts = await p.textContent("#summary");
  assert.match(facts, /After hours0\.3 h 1 entry/);
  assert.match(facts, /Interrupted a visit1 time/);
  assert.match(facts, /Healthy urgents assigned on top0\.5 h/);
  const cats = await p.$$eval("#topDelegable li > span:first-child", (x) => x.map((y) => y.textContent));
  assert.deepEqual(cats, ["DME / supplies", "Forms"]);
  const text = await p.textContent("#summaryText");
  assert.match(text, /0\.3 h was done after hours\. This work interrupted a visit 1 time\./);
});

test("the summary leaves out after-hours and interruption sentences when there are none", async () => {
  const p = await openTracker(browser, { storage: { entries: [entry("2026-11-10T10:00")] } });
  await report(p, "week");
  const text = await p.textContent("#summaryText");
  assert.doesNotMatch(text, /after hours|interrupted/);
});

test("task or role names that match built-in object names do not break the page", async () => {
  const names = ["constructor", "__proto__", "toString", "hasOwnProperty"];
  const p = await openTracker(browser, { storage: { entries: names.map((n, i) => entry(`2026-11-11T0${i + 5}:00`, { label: n, who: "constructor" })) } });
  await report(p, "week");
  assert.equal(await p.locator("#topDelegable li").count(), 4);
  await p.click("#tab-entries");
  assert.equal(await p.locator(".entry").count(), 4);
  assert.deepEqual(p.errors, []);
});

test("range presets: default This week, choice remembered, custom dates", async () => {
  const p = await openTracker(browser, { storage: { entries: [entry("2026-11-10T10:00")] } });
  await report(p);
  assert.equal(await p.textContent("#presets .on"), "This week");
  assert.equal(await p.inputValue("#from"), "2026-11-09", "weeks start on Monday");
  await p.click('#presets [data-range="4w"]');
  assert.equal(await p.inputValue("#from"), "2026-10-15");
  await p.reload(); await report(p);
  assert.equal(await p.textContent("#presets .on"), "Last 4 weeks");
  await p.fill("#from", "2026-11-01"); await p.dispatchEvent("#from", "change");
  assert.equal(await p.locator("#presets .on").count(), 0);
  assert.match(await p.textContent("#rangeLabel"), /^Custom range/);
});

test("an empty range shows guidance and no empty charts", async () => {
  const p = await openTracker(browser);
  await report(p);
  assert.equal(await p.textContent("#headline"), "Nothing logged in this range yet.");
  assert.ok(!(await p.isVisible("#splitBar")));
  assert.ok(!(await p.isVisible("#summary")));
});

test("CSV export: selected range only, oldest first, local dates, safe for spreadsheets", async () => {
  const p = await openTracker(browser, { storage: { entries: [
    entry("2026-10-01T10:00", { label: "Too old" }),
    entry("2026-11-10T21:00", { label: "=SUM(A1)", afterHours: true }),
    entry("2026-11-09T12:00", { label: "Café forms", timeUnknown: true }),
  ] } });
  await report(p, "week");
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#exportCsv")]);
  assert.equal(dl.suggestedFilename(), "complex-care-work_2026-11-09_to_2026-11-11.csv");
  const csv = fs.readFileSync(await dl.path(), "utf8");
  assert.equal(csv.charCodeAt(0), 0xfeff, "starts with a UTF-8 marker so Excel keeps accents");
  const lines = csv.slice(1).split("\n");
  assert.equal(lines[0], '"date","label","clinic","minutes","patient_facing","who_could_do","note","source","after_hours","interrupted_visit","start_time"');
  assert.equal(lines.length, 3, "the October entry is outside the range");
  assert.equal(lines[1], '"2026-11-09","Café forms","Complex Care","30","No","Clerical / admin","","","No","No",""');
  assert.equal(lines[2], '"2026-11-10","\'=SUM(A1)","Complex Care","30","No","Clerical / admin","","","Yes","No","21:00"');
});
