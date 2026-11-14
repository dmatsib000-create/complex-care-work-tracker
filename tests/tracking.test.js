// Timing work: tapping tiles, the running bar, the long-timer check, the Today strip, and safe text.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium, entry, openTracker, savedEntries, answerDialogs } = require("./helpers");

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

test("opens on Track with no timer running", async () => {
  const p = await openTracker(browser);
  assert.ok(await p.isVisible("#view-track"));
  assert.ok(!(await p.isVisible("#rangeBox")), "the date range only shows on Report and Entries");
  assert.ok(!(await p.isVisible("#running")));
  assert.equal(await p.locator(".tile").count(), 16);
  assert.deepEqual(p.errors, []);
});

test("one tap starts, a different tap switches and saves, tapping the active tile stops", async () => {
  const p = await openTracker(browser);
  await p.click(".tile >> text=Forms");
  assert.ok(await p.isVisible("#running"));
  assert.equal(await p.locator(".tile.active").getAttribute("aria-pressed"), "true");
  await p.click(".tile >> text=Prior auth");
  let saved = await savedEntries(p);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].label, "Forms");
  await p.click(".tile.active");
  saved = await savedEntries(p);
  assert.equal(saved.length, 2);
  assert.ok(!(await p.isVisible("#running")));
  assert.match(await p.textContent("#todayLine"), /logged/);
  assert.equal(await p.locator("#track .blk").count(), 2, "both blocks are drawn on the Today strip");
});

test("source and 'interrupted a visit' set while timing are saved; after hours comes from the start time", async () => {
  const p = await openTracker(browser, { now: "2026-11-11T18:15:00-08:00" });
  await p.click(".tile >> text=Phone with family");
  await p.selectOption("#rSource", "School");
  await p.check("#rInterrupted");
  assert.match(await p.textContent("#rSince"), /after hours/);
  await p.click("#stop");
  const [e] = await savedEntries(p);
  assert.equal(e.source, "School");
  assert.equal(e.interrupted, true);
  assert.equal(e.afterHours, true);
});

test("an evening entry belongs to its local day, not the UTC day", async () => {
  // 9pm Pacific on Nov 10 is already Nov 11 in UTC.
  const p = await openTracker(browser, { storage: { entries: [entry("2026-11-10T21:00")] } });
  await p.click("#tab-entries");
  await p.click('#presets [data-range="all"]');
  assert.match(await p.textContent(".day-head h3"), /November 10/);
  await p.fill("#from", "2026-11-11"); await p.fill("#to", "2026-11-11"); await p.dispatchEvent("#to", "change");
  assert.equal(await p.locator(".entry").count(), 0);
});

test("a timer left running is checked on stop: h:mm, re-asking, and discarding", async () => {
  const p = await openTracker(browser);
  const forgotten = async () => {
    await p.evaluate(() => localStorage.setItem("ccwt_running_v1", JSON.stringify(
      { label: "Forms", clinic: "Complex Care", facing: false, who: "Clerical / admin", startedAt: Date.now() - 5 * 3600e3 })));
    await p.reload();
  };
  await forgotten();
  assert.ok(await p.isVisible("#rLong"), "a long-running warning shows in the bar");
  answerDialogs(p, ["1:30"]); await p.click("#stop");
  assert.equal((await savedEntries(p))[0].minutes, 90);

  await forgotten();
  let seen = answerDialogs(p, ["", "45"]); await p.click("#stop");
  assert.equal(seen.length, 2, "an empty answer asks again");
  assert.equal((await savedEntries(p))[0].minutes, 45);

  await forgotten();
  seen = answerDialogs(p, ["1.5", "1.5h"]); await p.click("#stop");
  assert.equal(seen.length, 2, "a bare 1.5 is ambiguous and asks again");
  assert.equal((await savedEntries(p))[0].minutes, 90);

  await forgotten();
  const before = (await savedEntries(p)).length;
  answerDialogs(p, ["abc", null]); await p.click("#stop");
  assert.equal((await savedEntries(p)).length, before, "Cancel discards the entry");
  assert.ok(!(await p.isVisible("#running")));
});

test("text from labels and notes is shown as text, never run as code", async () => {
  const evil = '<img src=x onerror="window.pwned=1">';
  const p = await openTracker(browser, { storage: {
    entries: [entry("2026-11-11T09:00", { label: evil, note: evil, source: evil })],
    buttons: [{ label: evil, clinic: "Complex Care", facing: false, who: evil }] } });
  await p.click(".tile"); // start a timer on the injected button too
  for (const tab of ["#tab-report", "#tab-buttons", "#tab-entries"]) await p.click(tab);
  await p.click(".e-edit");
  assert.equal(await p.evaluate(() => window.pwned), undefined);
  assert.equal(await p.locator("main img").count(), 0);
  assert.deepEqual(p.errors, []);
});

test("phone width: no sideways scrolling, and the page makes no network requests", async () => {
  const p = await openTracker(browser, { viewport: { width: 390, height: 844 } });
  const requests = [];
  p.on("request", (r) => { if (!r.url().startsWith("file:")) requests.push(r.url()); });
  await p.reload();
  await p.click(".tile >> text=Forms");
  for (const tab of ["#tab-report", "#tab-entries", "#tab-buttons", "#tab-track"]) {
    await p.click(tab);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390, `${tab} fits a phone`);
  }
  assert.deepEqual(requests, []);
});
