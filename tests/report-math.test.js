// The report's numbers, tested directly through computeReport and summaryText (no clicking).
// These are the figures the case to a supervisor rests on.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium, entry, openTracker } = require("./helpers");

let browser, page;
before(async () => { browser = await chromium.launch(); page = await openTracker(browser); });
after(async () => { await browser.close(); });

// Run computeReport in the page. `list` defaults to all entries; dates are "YYYY-MM-DD".
const report = (all, { list = all, from = "", to = "", today = "2026-11-11" } = {}) =>
  page.evaluate(([l, a, f, t, d]) => computeReport(l, a, f, t, d), [list, all, from, to, today]);
const text = (all, opts = {}) =>
  page.evaluate(([l, a, f, t, d]) => summaryText(computeReport(l, a, f, t, d)),
    [opts.list || all, all, opts.from || "", opts.to || "", opts.today || "2026-11-11"]);

test("totals split by who could do the work", async () => {
  const r = await report([
    entry("2026-11-10T09:00", { who: "Only a physician", minutes: 60, facing: true }),
    entry("2026-11-10T10:00", { who: "Clerical / admin", minutes: 30 }),
    entry("2026-11-10T11:00", { who: "Care coordinator", minutes: 45, clinic: "Non-complex Healthy Urgent" }),
    entry("2026-11-10T18:00", { who: "MA", minutes: 15, afterHours: true, interrupted: true }),
  ]);
  assert.deepEqual(
    [r.total, r.physician, r.support, r.clerical, r.coordination, r.otherSupport, r.notFacing, r.urgent, r.afterHours, r.afterHoursCount, r.interruptions],
    [150, 60, 90, 30, 45, 15, 90, 45, 15, 1, 1]);
});

test("support hours per week and the support-role share", async () => {
  // 6 x 60 min clerical inside a 28-day range, first ever entry before the range.
  const all = ["2026-10-01", "2026-10-16", "2026-10-21", "2026-10-28", "2026-11-02", "2026-11-05", "2026-11-10"]
    .map((d) => entry(d + "T10:00", { minutes: 60 }));
  const r = await report(all, { list: all.slice(1), from: "2026-10-15", to: "2026-11-11" });
  assert.equal(r.spanDays, 28);
  assert.equal(r.fullWeek, true);
  assert.equal(r.supportPerWeek, 90);
  assert.equal(r.fte.toFixed(2), "0.04");
});

test("weeks count from the first day anything was logged, and never past today", async () => {
  const all = ["2026-11-09", "2026-11-10", "2026-11-11"].map((d) => entry(d + "T10:00", { minutes: 120 }));
  let r = await report(all, { from: "2026-10-15", to: "2026-11-11" });
  assert.deepEqual([r.startClamped, r.firstEver, r.spanDays, r.fullWeek], [true, "2026-11-09", 3, false]);
  r = await report(all, { from: "2026-11-09", to: "2026-11-30" });
  assert.equal(r.spanDays, 3, "days after today are not counted");
  r = await report(all);
  assert.equal(r.spanDays, 3, "an open range spans the first to the last entry");
});

test("support work by task: largest first, with the main role", async () => {
  const r = await report([
    entry("2026-11-10T10:00", { label: "Forms", minutes: 20 }),
    entry("2026-11-10T11:00", { label: "DME / supplies", who: "Care coordinator", minutes: 50 }),
    entry("2026-11-10T12:00", { label: "Forms", who: "MA", minutes: 10 }),
    entry("2026-11-10T13:00", { label: "Complex visit", who: "Only a physician", minutes: 90 }),
  ]);
  assert.deepEqual(r.byTask, [
    { label: "DME / supplies", minutes: 50, roles: ["Care coordinator"], mainRole: "Care coordinator" },
    { label: "Forms", minutes: 30, roles: ["Clerical / admin", "MA"], mainRole: "Clerical / admin" },
  ]);
});

test("an empty range gives zeros, not errors", async () => {
  const r = await report([]);
  assert.deepEqual([r.total, r.spanDays, r.supportPerWeek, r.byTask.length], [0, 0, 0, 0]);
});

test("the supervisor summary says exactly what the numbers say", async () => {
  const all = ["2026-10-15", "2026-10-22", "2026-10-29", "2026-11-05"].map((d) => entry(d + "T10:00", { minutes: 120 }))
    .concat([entry("2026-11-10T18:00", { label: "Complex visit", who: "Only a physician", minutes: 60, afterHours: true, interrupted: true })]);
  assert.equal(await text(all, { from: "2026-10-15", to: "2026-11-11" }),
    "In this period (28 days) I logged 9.0 h of work, about 2.3 h a week. " +
    "8.0 h (89%) did not require a physician: 8.0 h clerical and 0.0 h care coordination. " +
    "The largest delegable categories were Forms (8.0 h). " +
    "9.0 h was not patient-facing. 0.0 h was non-complex healthy urgent work assigned on top of complex care. " +
    "1.0 h was done after hours. This work interrupted a visit 1 time. " +
    "That is about 2.0 h a week of delegable work, roughly 0.05 of a 40-hour support FTE. " +
    "This is necessary complex-clinic work, not inefficiency. It needs clerical and care-coordination support.");
});
