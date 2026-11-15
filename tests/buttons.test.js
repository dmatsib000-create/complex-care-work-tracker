// Task buttons: the list in tracker.html is used unless she changes buttons on the page.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium, openTracker, saved, answerDialogs } = require("./helpers");

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

const tileLabels = (p) => p.$$eval(".tile .t-label", (x) => x.map((y) => y.textContent));

test("timing work does not save the button list, so edits to the file still apply", async () => {
  const p = await openTracker(browser);
  await p.click(".tile >> text=Forms"); await p.click("#stop");
  assert.equal(await saved(p, "buttons"), null);
});

test("a saved list identical to the file's list (from the older version) is cleared", async () => {
  const p = await openTracker(browser);
  await p.evaluate(() => localStorage.setItem("ccwt_buttons_v1", JSON.stringify(TAXONOMY)));
  await p.reload();
  assert.equal(await saved(p, "buttons"), null);
  await p.click("#tab-buttons");
  assert.ok(!(await p.isVisible("#bCustom")));
});

test("editing the TAXONOMY list in tracker.html takes effect", async () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "tracker.html"), "utf8").replace('{label:"Forms",', '{label:"Forms and letters",');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccwt-"));
  const file = path.join(dir, "tracker.html");
  fs.writeFileSync(file, src);
  const p = await openTracker(browser, { url: "file://" + file });
  assert.ok((await tileLabels(p)).includes("Forms and letters"));
});

test("changing buttons on the page saves them and shows a notice; reset returns to the file's list", async () => {
  const p = await openTracker(browser);
  await p.click("#tab-buttons");
  await p.fill("#bLabel", "Equipment letters"); await p.click("#bAdd");
  assert.ok(await p.isVisible("#bCustom"));
  assert.ok((await saved(p, "buttons")).some((b) => b.label === "Equipment letters"));
  await p.reload(); await p.click("#tab-buttons");
  assert.ok(await p.isVisible("#bCustom"), "still customised after a reload");
  answerDialogs(p, [true]); await p.click("#bReset");
  assert.ok(!(await p.isVisible("#bCustom")));
  assert.equal(await saved(p, "buttons"), null);
  assert.equal(await p.locator(".tile").count(), 24);
});

test("renaming a button back to the original makes it un-customised again", async () => {
  const p = await openTracker(browser);
  await p.click("#tab-buttons");
  const first = p.locator("#buttonList input").first();
  await first.fill("My visit"); await first.dispatchEvent("change");
  assert.ok(await p.isVisible("#bCustom"));
  await first.fill("Complex visit"); await first.dispatchEvent("change");
  assert.ok(!(await p.isVisible("#bCustom")));
  assert.equal(await saved(p, "buttons"), null);
});

test("renaming the button that is being timed keeps the timer attached to it", async () => {
  const p = await openTracker(browser);
  await p.click(".tile >> text=Forms");
  await p.click("#tab-buttons");
  const row = p.locator("#buttonList .bitem").nth(16);
  await row.locator("input").first().fill("Forms and letters"); await row.locator("input").first().dispatchEvent("change");
  assert.equal(await p.textContent("#rLabel"), "Forms and letters");
  await p.click("#tab-track");
  assert.equal(await p.textContent(".tile.active .t-label"), "Forms and letters");
});

test("removing a button asks first", async () => {
  const p = await openTracker(browser);
  await p.click("#tab-buttons");
  answerDialogs(p, [false]); await p.locator("#buttonList .bitem button").first().click();
  assert.equal(await p.locator("#buttonList .bitem").count(), 24);
  answerDialogs(p, [true]); await p.locator("#buttonList .bitem button").first().click();
  assert.equal(await p.locator("#buttonList .bitem").count(), 23);
});
