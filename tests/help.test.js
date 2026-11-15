// The Help page: the quick start and the FAQ, the Help link in the header, and the links to and from it.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium, openTracker, editedTracker } = require("./helpers");

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

test("the Help page holds the quick start and the FAQ, without the date range", async () => {
  const p = await openTracker(browser);
  await p.click("#topHelp");
  assert.ok(await p.isVisible("#view-help"));
  assert.ok(!(await p.isVisible("#view-track")));
  assert.ok(!(await p.isVisible("#rangeBox")));
  assert.equal(await p.textContent("#quickstart"), "Quick start");
  assert.ok((await p.locator("#view-help .steps li").count()) >= 5);
  assert.ok((await p.locator("#view-help .faq details").count()) >= 15);
  // An answer opens on tap.
  const q = p.locator("#view-help details", { hasText: "What counts as after hours?" });
  assert.ok(!(await q.locator("p").isVisible()));
  await q.locator("summary").click();
  assert.match(await q.locator("p").textContent(), /before 8am or from 5pm, or on a weekend/);
  assert.match(await p.textContent("#helpLong"), /^2 h$/);
  assert.deepEqual(p.errors, []);
});

test("Help opens from the header, the Track tab and the footer, and its links open the tabs", async () => {
  const p = await openTracker(browser);
  await p.click("#howtoHelp");
  assert.ok(await p.isVisible("#view-help"));
  assert.equal(await p.getAttribute("#topHelp", "aria-current"), "page");
  assert.equal(await p.locator('nav [aria-selected="true"]').count(), 0, "no tab is marked as showing");
  assert.equal(await p.evaluate(() => document.activeElement.id), "quickstart");
  await p.click("#tab-track");
  await p.click("footer [data-go=help]");
  assert.ok(await p.isVisible("#view-help"));
  await p.click('#view-help .steps [data-go="entries"]');
  assert.ok(await p.isVisible("#view-entries"));
  assert.equal(await p.getAttribute("#tab-entries", "aria-selected"), "true");
  assert.equal(await p.getAttribute("#topHelp", "aria-current"), null);
  assert.ok(await p.isVisible("#rangeBox"));
  await p.click("#topHelp");
  await p.locator("#view-help details", { hasText: "How do I back up?" }).locator("summary").click();
  await p.click("#helpBackup");
  assert.ok(await p.isVisible("#backupPanel"));
  assert.deepEqual(p.errors, []);
});

test("the help quotes the clinic hours and the long-timer limit from the settings", async () => {
  const url = editedTracker([["const CLINIC_START_HOUR = 8, CLINIC_END_HOUR = 17;", "const CLINIC_START_HOUR = 7.5, CLINIC_END_HOUR = 18;"],
    ["const LONG_TIMER_MIN = 120;", "const LONG_TIMER_MIN = 90;"]]);
  const p = await openTracker(browser, { url });
  assert.equal(await p.textContent("#helpHours"), "before 7:30am or from 6pm");
  assert.equal(await p.textContent("#helpLong"), "1 h 30 min");
  assert.deepEqual(p.errors, []);
});

test("phone: Help is in the header beside the title, and the Help page does not scroll sideways", async () => {
  // Checked with the page's own fonts, Verdana (wide) and a serif (narrow), since phones and test machines differ.
  for (const width of [320, 375]) for (const font of ["", "Verdana", "serif"]) {
    const p = await openTracker(browser, { viewport: { width, height: 700 } });
    if (font) await p.addStyleTag({ content: `body,button{font-family:${font}!important}` });
    const [help, title] = await Promise.all(["#topHelp", "h1"].map((s) => p.$eval(s, (el) => el.getBoundingClientRect().toJSON())));
    assert.ok(help.right <= width - 8 && help.top < title.bottom, `${width}px ${font}: Help is on the title's row, inside the screen`);
    assert.ok(help.height >= 44 && help.width >= 44, `${width}px ${font}: Help is ${help.width}x${help.height}px, at least 44x44`);
    await p.click("#topHelp");
    await p.locator("#view-help details summary").first().click();
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), width);
    await p.close();
  }
});

test("phone: each FAQ question opens from anywhere on its row, not only its line of text", async () => {
  const p = await openTracker(browser, { viewport: { width: 375, height: 700 } });
  await p.click("#topHelp");
  const q = p.locator("#view-help details").first();
  await q.scrollIntoViewIfNeeded();
  const row = await q.locator("summary").boundingBox();
  assert.ok(row.height >= 44, `the question's row is ${row.height}px tall`);
  await p.mouse.click(row.x + row.width - 10, row.y + 4); // the top right corner, away from the text
  assert.equal(await q.getAttribute("open"), "");
  assert.deepEqual(p.errors, []);
});

test("the colour key names each role in its own highlighter, from the settings", async () => {
  const p = await openTracker(browser);
  assert.equal(await p.textContent("#helpRoles"), "RN, care coordinator, social work, clerical / admin or other roles");
  assert.deepEqual(await p.$$eval("#helpRoles .mark", (x) => x.map((y) => y.className)),
    ["mark r-rn", "mark r-coord", "mark r-sw", "mark r-cler", "mark r-other"]);
  // The headline answer names the same roles, and the others the headline counts.
  assert.equal(await p.textContent("#helpRolesText"), "RN, care coordinator, social work, clerical / admin, or another role such as an MA");
});

test("a browser with nothing in it offers the quick start under the title, until work is logged", async () => {
  const p = await openTracker(browser);
  assert.match(await p.textContent("#todayLine"), /^Nothing logged yet\. New here\? Read the quick start\.$/);
  await p.click("#firstHelp");
  assert.ok(await p.isVisible("#view-help"));
  assert.ok(!(await p.isVisible("footer [data-go=help]")), "the footer does not link to the page being read");
  await p.click("#tab-track");
  assert.ok(await p.isVisible("footer [data-go=help]"));
  await p.click(".tile >> text=Forms");
  await p.click("#stop");
  await p.evaluate(() => { localStorage.setItem("ccwt_entries_v1", JSON.stringify(JSON.parse(localStorage.getItem("ccwt_entries_v1"))
    .map((e) => ({ ...e, date: new Date(Date.now() - 86400e3).toISOString() })))); });
  await p.reload();
  assert.equal(await p.textContent("#todayLine"), "Nothing logged today yet.");
});

test("keyboard: with Help open a tab can still be reached, and the quick start link keeps focus over a redraw", async () => {
  const p = await openTracker(browser);
  await p.focus("#firstHelp");
  await p.clock.runFor(31000); // the line under the title is redrawn every 30 seconds
  assert.equal(await p.evaluate(() => document.activeElement.id), "firstHelp");
  await p.keyboard.press("Enter");
  assert.ok(await p.isVisible("#view-help"));
  assert.deepEqual(await p.$$eval("nav button", (x) => x.filter((b) => b.tabIndex === 0).map((b) => b.id)), ["tab-track"]);
  assert.equal(await p.locator('nav [aria-selected="true"]').count(), 0);
});

test("phone: with a timer running, the footer can still be scrolled clear of the timer bar", async () => {
  for (const width of [320, 375]) {
    const p = await openTracker(browser, { viewport: { width, height: 700 } });
    await p.click(".tile >> text=Forms"); // a support task, so the bar also has "Needed a clinician"
    await p.evaluate(() => scrollTo(0, document.body.scrollHeight));
    const [bar, link] = await Promise.all(["#running", "footer a"].map((s) => p.$eval(s, (el) => el.getBoundingClientRect().toJSON())));
    assert.ok(link.bottom <= bar.top, `${width}px: the last footer link ends at ${link.bottom}px, the bar starts at ${bar.top}px`);
    await p.close();
  }
});
