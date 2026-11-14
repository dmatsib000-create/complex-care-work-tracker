// Staying current: two tabs open at once, and a page left open past midnight.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium, newContext, openTracker, savedEntries } = require("./helpers");

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

test("two tabs: neither overwrites the other, and timers stay in step", async () => {
  const ctx = await newContext(browser);
  const A = await openTracker(browser, { context: ctx });
  const B = await openTracker(browser, { context: ctx });
  await B.click(".tile >> text=Forms"); await B.click("#stop");
  await A.waitForFunction(() => /logged/.test(document.getElementById("todayLine").textContent));
  await A.click(".tile >> text=Scheduling"); await A.click("#stop");
  assert.deepEqual((await savedEntries(A)).map((e) => e.label).sort(), ["Forms", "Scheduling"]);

  await A.click(".tile >> text=Prior auth");
  await B.waitForSelector("#running", { state: "visible" });
  await B.click("#stop");
  await A.waitForSelector("#running", { state: "hidden" });
  assert.equal((await savedEntries(A)).length, 3);
});

test("left open past midnight: Today and the manual-add date move to the new day", async () => {
  const ctx = await newContext(browser, { now: "2026-11-16T23:58:00-08:00" });
  const p = await openTracker(browser, { context: ctx, storage: { range: "today" } });
  await ctx.clock.fastForward("05:00");
  await p.click(".tile >> text=Forms");
  await ctx.clock.fastForward("03:00");
  await p.click("#stop");
  await p.click("#tab-report");
  assert.equal(await p.inputValue("#from"), "2026-11-17");
  assert.doesNotMatch(await p.textContent("#headline"), /^Nothing/);
  assert.equal(await p.inputValue("#mDate"), "2026-11-17");
});

test("a manual-add date she picked herself is not moved at midnight", async () => {
  const ctx = await newContext(browser, { now: "2026-11-16T23:58:00-08:00" });
  const p = await openTracker(browser, { context: ctx });
  await p.click("#tab-entries"); await p.click("#addBox summary");
  await p.fill("#mDate", "2026-11-12"); await p.dispatchEvent("#mDate", "change");
  await ctx.clock.fastForward("05:00");
  assert.equal(await p.inputValue("#mDate"), "2026-11-12");
});
