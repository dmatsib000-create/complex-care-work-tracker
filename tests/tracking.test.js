// Timing work: tapping tiles, the running bar, the long-timer check, the Today strip, and safe text.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium, entry, openTracker, savedEntries } = require("./helpers");

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

test("opens on Track with no timer running", async () => {
  const p = await openTracker(browser);
  assert.ok(await p.isVisible("#view-track"));
  assert.ok(!(await p.isVisible("#rangeBox")), "the date range only shows on Report and Entries");
  assert.ok(!(await p.isVisible("#running")));
  assert.equal(await p.locator(".tile").count(), 24);
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

// Start a timer that began 5 hours ago, as if left running.
async function forgottenTimer(p, label = "Forms") {
  await p.evaluate((l) => localStorage.setItem("ccwt_running_v1", JSON.stringify(
    { label: l, clinic: "Complex Care", facing: false, who: "Clerical / admin", startedAt: Date.now() - 5 * 3600e3 })), label);
  await p.reload();
}

test("a timer left running is checked in a panel on stop: corrected time, re-asking, discarding", async () => {
  const p = await openTracker(browser);
  await forgottenTimer(p);
  assert.ok(await p.isVisible("#rLong"), "a long-running warning shows in the bar");
  await p.click("#stop");
  assert.ok(await p.isVisible("#longPanel"));
  assert.match(await p.textContent("#longText"), /"Forms" has been timing for 5 h, since 5:00am\./);
  assert.equal(await p.inputValue("#longMinutes"), "300", "prefilled with the full time");
  assert.equal((await savedEntries(p)).length, 0, "nothing is saved until she answers");

  await p.fill("#longMinutes", "1:30"); await p.click("#longSave");
  assert.ok(!(await p.isVisible("#longPanel")));
  assert.equal((await savedEntries(p))[0].minutes, 90);

  await forgottenTimer(p); await p.click("#stop");
  for (const bad of ["", "1.5", "abc"]) {
    await p.fill("#longMinutes", bad); await p.click("#longSave");
    assert.ok(await p.isVisible("#longPanel"), `"${bad}" is not accepted`);
    assert.match(await p.textContent("#longError"), /is not a time this tracker can read/);
  }
  await p.fill("#longMinutes", "1.5h"); await p.press("#longMinutes", "Enter");
  assert.equal((await savedEntries(p))[0].minutes, 90, "Enter saves; 1.5h is read as hours");

  await forgottenTimer(p); await p.click("#stop");
  const before = (await savedEntries(p)).length;
  await p.click("#longDiscard");
  assert.equal((await savedEntries(p)).length, before, "Discard throws the entry away");
  assert.ok(!(await p.isVisible("#running")));
  assert.deepEqual(p.errors, []);
});

test("Keep timing (or Escape) closes the panel and leaves the timer running", async () => {
  const p = await openTracker(browser);
  await forgottenTimer(p);
  await p.click("#stop"); await p.click("#longKeep");
  assert.ok(!(await p.isVisible("#longPanel")));
  assert.ok(await p.isVisible("#running"));
  await p.click("#stop"); await p.keyboard.press("Escape");
  assert.ok(!(await p.isVisible("#longPanel")));
  assert.ok(await p.isVisible("#running"));
  assert.equal((await savedEntries(p)).length, 0);
});

test("tapping another task while a long timer runs checks it first, then starts the new task", async () => {
  const p = await openTracker(browser);
  await forgottenTimer(p);
  await p.click(".tile >> text=Prior auth");
  assert.ok(await p.isVisible("#longPanel"));
  assert.ok(!(await p.isVisible("#longKeep")), "switching tasks ends this timer either way");
  await p.fill("#longMinutes", "20"); await p.click("#longSave");
  const [e] = await savedEntries(p);
  assert.deepEqual([e.label, e.minutes], ["Forms", 20]);
  assert.equal(await p.textContent("#rLabel"), "Prior auth");

  await forgottenTimer(p, "Scheduling");
  await p.click(".tile >> text=Forms"); await p.click("#longDiscard");
  assert.equal(await p.textContent("#rLabel"), "Forms", "Discard also starts the tapped task");
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

test("phone width: the first task buttons are on the first screen", async () => {
  const p = await openTracker(browser, { viewport: { width: 375, height: 667 } });
  const top = await p.$eval("#gridDoc .tile", (el) => el.getBoundingClientRect().top);
  assert.ok(top < 667 / 2, `first tile starts at ${Math.round(top)}px, in the top half of a small phone screen`);
  assert.ok(await p.isVisible("#track"), "the Today strip is still on the page, below the buttons");
});

test("starting a timer does not change any tile's size, so the buttons stay put", async () => {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 667 }]) {
    const p = await openTracker(browser, { viewport });
    // Each tile's height and its distance from the first tile.
    const boxes = () => p.$$eval(".tile", (els) => { const top0 = els[0].getBoundingClientRect().top;
      return els.map((el) => { const r = el.getBoundingClientRect(); return [r.top - top0, r.height]; }); });
    const firstTop = () => p.$eval(".tile", (el) => el.getBoundingClientRect().top + scrollY);
    const before = await boxes(), top = await firstTop();
    await p.click(".tile >> text=Notes / documentation");
    assert.equal(await firstTop(), top, `${viewport.width}px wide: the first tap of the day does not push the buttons down`);
    for (const label of ["Notes / documentation", "Prescription coordination", "Healthy urgent inbox / follow-up"]) {
      if (label !== "Notes / documentation") await p.click(`.tile >> text=${label}`);
      assert.deepEqual(await boxes(), before, `${viewport.width}px wide, timing "${label}"`);
    }
  }
});

test("screen readers hear when a timer starts and is saved, not every tick", async () => {
  const p = await openTracker(browser);
  assert.equal(await p.getAttribute("#running", "aria-live"), null, "the ticking bar is not a live region");
  await p.click(".tile >> text=Forms");
  await p.waitForFunction(() => document.getElementById("runStatus").textContent === "Timing Forms.");
  await p.click(".tile >> text=Prior auth");
  await p.waitForFunction(() => document.getElementById("runStatus").textContent === "Saved Forms, 1 min. Timing Prior auth.");
});

test("the label of an active clinician tile is readable on the dark tile", async () => {
  const p = await openTracker(browser);
  await p.click(".tile >> text=Complex visit");
  const color = await p.$eval(".tile.active .mark", (el) => getComputedStyle(el).color);
  assert.equal(color, "rgb(255, 255, 255)");
});

test("'Needed a clinical decision' turns a support task into clinician work for that entry only", async () => {
  const p = await openTracker(browser);
  await p.click(".tile >> text=Phone with family");
  assert.ok(await p.isVisible("#rClinician"), "offered for support tasks");
  await p.check("#rClinician");
  assert.equal(await p.locator("#track .blk.r-doc").count(), 1, "the live block turns physician blue");
  await p.click("#stop");
  await p.click(".tile >> text=Phone with family");
  assert.ok(!(await p.isChecked("#rClinician")), "the next call starts unticked");
  await p.click("#stop");
  assert.deepEqual((await savedEntries(p)).map((e) => e.who), ["RN", "Physician or PA"]);
  await p.click(".tile >> text=Complex visit");
  assert.ok(!(await p.isVisible("#rClinician")), "not offered for clinician tasks");
});

test("unticking 'Needed a clinical decision' returns the task to its preset role", async () => {
  const p = await openTracker(browser);
  await p.click(".tile >> text=Forms");
  await p.check("#rClinician"); await p.uncheck("#rClinician");
  await p.click("#stop");
  assert.equal((await savedEntries(p))[0].who, "Clerical / admin");
});

test("clinician tiles show today's time on that task; support tiles show who could do it", async () => {
  const p = await openTracker(browser, { storage: { entries: [
    entry("2026-11-11T08:00", { label: "Complex visit", who: "Physician or PA", minutes: 50 }),
    entry("2026-11-11T09:00", { label: "Complex visit", who: "Physician or PA", minutes: 60 }),
    entry("2026-11-10T09:00", { label: "Complex inbox", who: "Physician or PA", minutes: 30 }),
  ] } });
  const meta = (label) => p.locator(".tile", { hasText: label }).locator(".t-meta").textContent();
  assert.equal(await meta("Complex visit"), "Today 1 h 50 min");
  assert.equal(await meta("Complex inbox"), "Not yet today", "yesterday's work is not counted");
  assert.equal(await meta("Healthy urgent visit"), "Not yet today");
  assert.equal(await meta("Phone with family"), "RN");
  // Screen readers still hear that a clinician tile needs a physician or PA, as the group heading is not read with each button.
  assert.equal(await p.getByRole("button", { name: "Complex visit (needs a physician or PA) Today 1 h 50 min" }).count(), 1);
  assert.equal(await p.getByRole("button", { name: "Phone with family RN" }).count(), 1);
  await p.click(".tile >> text=Complex inbox"); await p.clock.runFor(5 * 60000); await p.click("#stop");
  assert.equal(await meta("Complex inbox"), "Today 5 min");
  // A change made under Entries shows on the tile straight away.
  await p.click("#tab-entries"); await p.click(".e-edit >> nth=0");
  await p.fill('.editor input[type="number"]', "20"); await p.dispatchEvent('.editor input[type="number"]', "change");
  await p.click("#tab-track");
  assert.equal(await meta("Complex inbox"), "Today 20 min");
});
