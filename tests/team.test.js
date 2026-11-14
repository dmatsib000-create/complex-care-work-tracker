// The Team tab: several people's backup files read into one report, without adding them to this browser.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium, entry, openTracker, savedEntries } = require("./helpers");

let browser, dir;
before(async () => { browser = await chromium.launch(); dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccwt-team-")); });
after(async () => { await browser.close(); });

const writeFile = (name, data) => { const f = path.join(dir, name); fs.writeFileSync(f, typeof data === "string" ? data : JSON.stringify(data)); return f; };
// A backup file in the shape Save backup file writes. `savedAt` is a local Pacific time like "2026-11-04T17:00".
const backup = (name, entries, savedAt = "2026-11-11T09:00") =>
  writeFile(name, { app: "complex-care-work-tracker", format: 1, savedAt: new Date(savedAt + "-08:00").toISOString(), entries, buttons: null });
// The date range is shared with the Report tab, and on the Team tab it only shows once someone is added: pick it on Report.
const team = async (p, range) => {
  if (range) { await p.click("#tab-report"); await p.click(`#presets [data-range="${range}"]`); }
  await p.click("#tab-team"); };
// Add files and wait for the message that says what happened to each one.
const add = async (p, files) => {
  await p.evaluate(() => { document.getElementById("teamMsg").textContent = ""; });
  await p.setInputFiles("#teamFile", files);
  await p.waitForFunction(() => document.getElementById("teamMsg").textContent !== "");
  return p.$$eval("#teamMsg li", (x) => x.map((y) => y.textContent));
};
const labels = (p) => p.$$eval("#teamPeople .p-head input", (x) => x.map((y) => y.value));
const card = (p, i) => p.textContent(`#teamPeople .person:nth-child(${i + 1})`);

// Three people. A: 6 h clerical inside the last 4 weeks, first entry before it (1.5 h a week).
// B: started 29 Oct, file saved 4 Nov, so 7 days count (4 h of RN work a week), not the 14 days to today.
// C: started 9 Nov, 3 days logged, so left out of the weekly figures.
const peopleA = () => ["2026-10-01", "2026-10-16", "2026-10-21", "2026-10-28", "2026-11-02", "2026-11-05", "2026-11-10"]
  .map((d) => entry(d + "T10:00", { minutes: 60 }));
const peopleB = () => [entry("2026-10-29T10:00", { label: "Phone with family", who: "RN", minutes: 120 }),
  entry("2026-11-04T10:00", { label: "Results follow-up", who: "RN", minutes: 120 })];
const peopleC = () => ["09", "10", "11"].map((d) => entry(`2026-11-${d}T09:00`, { label: "Referral coordination", who: "Care coordinator", minutes: 60 }));

test("team math: weeks count from each person's first entry to the day their file was saved", async () => {
  const p = await openTracker(browser);
  const a = peopleA();
  const t = await p.evaluate(([a, b, c]) => {
    const t = computeTeam([{ label: "A", entries: a }, { label: "B", entries: b, today: "2026-11-04" }, { label: "C", entries: c }], "2026-10-15", "2026-11-11", "2026-11-11");
    return { ...t, text: teamSummaryText(t) };
  }, [a, peopleB(), peopleC()]);
  assert.deepEqual(t.each.map((x) => [x.r.spanDays, Math.round(x.r.supportPerWeek), x.weekly]), [[28, 90, true], [7, 240, true], [3, 420, false]]);
  assert.equal(t.total, 360 + 240 + 180);
  assert.equal(t.support, t.total);
  assert.deepEqual([t.week.people, Math.round(t.week.support), Math.round(t.week.nurse), Math.round(t.week.clerical), t.week.low, t.week.high], [2, 330, 240, 90, 90, 240]);
  assert.equal(t.week.fte.toFixed(4), "0.1375");
  assert.deepEqual(t.short, ["C"]);
  assert.match(t.text, /^In this period \(28 days\) 3 clinicians each tracked their own work and together logged 13\.0 h\./);
  assert.match(t.text, /Across the 2 clinicians with a full week logged, that is about 5\.5 h a week of delegable work \(4\.0 h nursing, 0 h care coordination, 1\.5 h clerical\), roughly 0\.14 of a 40-hour support FTE\. Per clinician it ranged from 1\.5 h to 4\.0 h a week\./);
  assert.match(t.text, /Measured across 3 clinicians, this is a question of how the team is staffed/);
  assert.doesNotMatch(t.text, /\bA\b|\bB\b|Clinician/, "the summary has no line for each person");
});

test("backup files are read for the report only: nothing is added to this browser, and a reload forgets them", async () => {
  const own = [entry("2026-11-10T09:00", { label: "Complex visit", who: "Physician or PA", facing: true, minutes: 60 })];
  const p = await openTracker(browser, { storage: { entries: own } });
  await team(p, "4w");
  assert.ok(await p.isVisible("#teamEmpty"));
  assert.ok(!(await p.isVisible("#teamReport")));
  assert.ok(!(await p.isVisible("#rangeBox")), "the first thing on the Team tab is adding files, not dates");
  const msgs = await add(p, [backup("a.json", peopleA()), backup("b.json", peopleB(), "2026-11-04T17:00")]);
  assert.deepEqual(msgs, ["Added a.json as Clinician A: 7 entries.", "Added b.json as Clinician B: 2 entries."]);
  assert.deepEqual(await labels(p), ["Clinician A", "Clinician B"]);
  assert.ok(await p.isVisible("#teamReport"));
  assert.equal((await savedEntries(p)).length, 1, "the files are not merged into this browser's entries");

  await p.check("#teamMine");
  assert.deepEqual(await labels(p), ["Clinician C", "Clinician A", "Clinician B"]);
  assert.match(await card(p, 0), /Entries in this browser · 1 entry/s);
  assert.match(await p.textContent("#teamHeadline"), /^Across 3 clinicians, 10\.0 h of 11\.0 h logged \(91%\) did not need a physician or PA\.$/);
  // Editing an entry here updates the team figures straight away.
  await p.click("#tab-entries"); await p.click(".e-edit");
  await p.fill('.editor input[type="number"]', "120"); await p.dispatchEvent('.editor input[type="number"]', "change");
  await team(p);
  assert.match(await p.textContent("#teamHeadline"), /^Across 3 clinicians, 10\.0 h of 12\.0 h logged/);
  // A label being typed is kept when the page re-renders (for example after a change in another tab).
  const lab = p.locator("#teamPeople .p-head input").nth(1);
  await lab.fill("Site 2 nurse lead"); await p.evaluate(() => render());
  assert.equal(await lab.inputValue(), "Site 2 nurse lead");
  assert.ok(await lab.evaluate((el) => el === document.activeElement));
  await lab.press("Tab");
  assert.deepEqual(await labels(p), ["Clinician C", "Site 2 nurse lead", "Clinician B"]);
  await p.uncheck("#teamMine");
  assert.deepEqual(await labels(p), ["Site 2 nurse lead", "Clinician B"]);

  await p.click("#tab-report");
  assert.match(await p.textContent("#headline"), /0 h of 2\.0 h logged/, "the Report tab still shows only this browser's work");
  await p.reload(); await team(p);
  assert.ok(await p.isVisible("#teamEmpty"), "loaded files are kept in memory only");
  assert.equal((await savedEntries(p)).length, 1);
  assert.deepEqual(p.errors, []);
});

test("team totals, each person's figures, labels, and the copyable summary", async () => {
  const p = await openTracker(browser);
  await p.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await team(p, "4w");
  await add(p, [backup("a.json", peopleA()), backup("b.json", peopleB(), "2026-11-04T17:00"), backup("c.json", peopleC())]);
  assert.match(await p.textContent("#rangeLabel"), /^Last 4 weeks: .*, 11 entries from 3 clinicians\.$/);
  // The date range sits under "Add backup files", just above the results.
  const y = async (sel) => (await p.locator(sel).boundingBox()).y;
  assert.ok((await y("#teamLoad")) < (await y("#rangeBox")) && (await y("#rangeBox")) < (await y("#teamHeadline")));
  assert.match(await p.textContent("#teamHeadline"), /^Across 3 clinicians, 13\.0 h of 13\.0 h logged \(100%\) did not need a physician or PA\.$/);
  assert.equal(await p.textContent("#teamFte"),
    "Together that is 5.5 h a week of support work, about 0.14 of a full-time support role (40 hours a week), currently done by physicians and PAs. Not in the weekly figures: Clinician C (less than a full week logged).");
  assert.match(await p.textContent("#teamFacts"), /Logged per week, 2 of 3 clinicians5\.5 h 13\.0 h in total/);
  assert.match(await p.textContent("#teamLegend"), /RN: 4\.0 h \(31%\).*Care coordinator: 3\.0 h \(23%\).*Clerical \/ admin: 6\.0 h \(46%\)/);
  assert.match(await card(p, 0), /6\.0 h logged, 1\.5 h a week\. 6\.0 h \(100%\) did not need a physician or PA\..*About 0\.04 of a full-time support role/s);
  assert.match(await card(p, 1), /b\.json, saved .*Nov.* · 2 entries.*4\.0 h logged, 4\.0 h a week/s);
  assert.match(await card(p, 2), /Less than a full week logged in this range \(3 days from the first entry on .*\), so not in the weekly figures\./s);
  const tasks = await p.$$eval("#teamTasks li > span:first-child", (x) => x.map((y) => y.textContent));
  assert.deepEqual(tasks, ["Forms", "Referral coordination", "Phone with family", "Results follow-up"]);

  // Labels: editable, an empty or repeated label goes back to what it was.
  const c = p.locator("#teamPeople .p-head input").nth(2);
  await c.fill("Newer clinician"); await c.press("Tab");
  assert.match(await p.textContent("#teamFte"), /Not in the weekly figures: Newer clinician \(less than a full week logged\)\./);
  assert.equal(await p.locator("#teamPeople .person").count(), 3);
  assert.equal(await p.getAttribute("#teamPeople [data-remove='2']", "aria-label"), "Remove Newer clinician");
  await c.fill(""); await c.press("Tab");
  assert.equal(await c.inputValue(), "Newer clinician");
  assert.equal(await p.textContent("#teamMsg"), "A label cannot be empty, so it was changed back to Newer clinician.");
  await c.fill("Clinician A"); await c.press("Tab");
  assert.equal(await c.inputValue(), "Newer clinician");
  assert.match(await p.textContent("#teamMsg"), /"Clinician A" is already the label of another clinician/);

  await p.click("#copyTeam");
  await p.waitForFunction(() => document.getElementById("teamCopied").textContent !== "");
  assert.equal(await p.textContent("#teamCopied"), "Copied. Paste it into an email or document.");
  assert.equal(await p.evaluate(() => navigator.clipboard.readText()), await p.textContent("#teamSummary"));

  // A short range: no weekly estimate from a few days.
  await p.click('#presets [data-range="today"]');
  assert.match(await p.textContent("#teamFte"), /Choose a range of 7 days or more/);
  assert.match(await card(p, 1), /Nothing logged in this range\./s);

  assert.equal(await p.locator("#teamPeople .danger").count(), 0, "removing one person is not shown as a red, destructive action");
  await p.click("#teamPeople [data-remove='0']");
  assert.deepEqual(await labels(p), ["Clinician B", "Newer clinician"]);
  await p.click("#teamClear");
  assert.ok(await p.isVisible("#teamEmpty"));
  assert.ok(!(await p.isVisible("#rangeBox")), "no date range until someone is added");
  await p.click("#tab-report");
  assert.ok((await y("#rangeBox")) < (await y("#headline")), "back above the report on the Report tab");
  assert.deepEqual(p.errors, []);
});

test("files that cannot be read are refused with a reason, and the rest still load", async () => {
  const p = await openTracker(browser);
  await team(p, "4w");
  const msgs = await add(p, [
    writeFile("notes.json", "not json"),
    writeFile("other.json", { hello: 1 }),
    writeFile("empty.json", { entries: [] }),
    writeFile("broken.json", { entries: [{ label: "", minutes: 5 }, { label: "X", date: "nonsense", minutes: 5 }] }),
    backup("mixed.json", [entry("2026-11-10T10:00"), { label: "Forms", minutes: 0, date: "2026-11-10" }]),
  ]);
  assert.deepEqual(msgs, [
    "notes.json is not a backup from this tracker. Choose a file saved with Save backup file.",
    "other.json has no entries in it. Choose a file saved with Save backup file.",
    "empty.json has no entries yet. It was not added.",
    "None of the 2 entries in broken.json could be read. It was not added.",
    "Added mixed.json as Clinician A: 1 entry. 1 could not be read and was skipped.",
  ]);
  assert.match(await card(p, 0), /1 entry, 1 could not be read/s);
  assert.ok(await p.isVisible("#teamOne"), "one person is not yet a team");
  assert.deepEqual(p.errors, []);
});

test("the same person is not counted twice; a newer backup replaces the older one", async () => {
  const mine = peopleA();
  const p = await openTracker(browser, { storage: { entries: mine } });
  await team(p, "4w");
  await p.check("#teamMine");
  assert.deepEqual(await add(p, [backup("my-backup.json", mine)]),
    ["my-backup.json has the same entries as this browser (Clinician A), so it looks like the same clinician. It was not added again."]);

  // Ids are creation times, as in the tracker: each entry saved when its timer stopped.
  const b = peopleB().map((e) => ({ ...e, id: Date.parse(e.date) + e.minutes * 60000 }));
  await add(p, [backup("b-old.json", b.slice(0, 1), "2026-11-01T09:00")]);
  assert.deepEqual(await add(p, [backup("b-old.json", b.slice(0, 1), "2026-11-01T09:00")]),
    ["b-old.json has the same entries as Clinician B, so it looks like the same clinician. It was not added again."]);
  assert.deepEqual(await add(p, [backup("b-new.json", b, "2026-11-04T17:00")]), ["b-new.json is a newer backup of Clinician B, so it replaces the older one."]);
  assert.deepEqual(await labels(p), ["Clinician A", "Clinician B"]);
  assert.match(await card(p, 1), /b-new\.json.*2 entries/s);
  // A later file with B's entries plus older ones B never had (a colleague's backup restored into B's browser) is not B's newer backup.
  const older = [entry("2026-10-20T10:00", { label: "DME / supplies", who: "Care coordinator", id: Date.parse("2026-10-20T10:30:00-08:00") })];
  assert.deepEqual(await add(p, [backup("b-merged.json", [...b, ...older], "2026-11-10T17:00")]),
    ["b-merged.json has Clinician B's entries plus 1 older entry that is not in Clinician B's file, so it may also hold someone else's work (for example after restoring a colleague's backup). It was not added. Ask for a backup from a browser that only one person tracks in."]);
  assert.match(await card(p, 1), /b-new\.json/s, "Clinician B keeps the file it had");

  // Her own backup loaded first, then "Include the entries in this browser" is refused.
  await p.uncheck("#teamMine");
  await add(p, [backup("my-backup.json", mine)]);
  await p.click("#teamMine");
  assert.ok(!(await p.isChecked("#teamMine")));
  assert.match(await p.textContent("#teamMsg"), /already in the report as Clinician A, from my-backup\.json/);

  // Someone who restored a colleague's backup into their own browser: the shared entries are pointed out.
  await add(p, [backup("d.json", [...peopleC(), mine[0]])]);
  assert.deepEqual(await labels(p), ["Clinician B", "Clinician A", "Clinician C"]);
  assert.match(await card(p, 2), /1 entry is also in Clinician A's data, so it may be counted twice\./s);
  assert.match(await card(p, 1), /1 entry is also in Clinician C's data/s);
  assert.deepEqual(p.errors, []);
});

test("older backups, renamed roles, and names this page does not list", async () => {
  const p = await openTracker(browser);
  await team(p, "4w");
  // An early backup: a plain list, no ids, no after-hours field, the old name for physician work, and its own names.
  const old = [
    { date: "2026-11-02T17:00:00.000Z", label: "Complex visit", clinic: "Complex Care", facing: true, who: "Only a physician", minutes: 60 },
    { date: "2026-11-03T03:00:00.000Z", label: "Equipment letters", clinic: "Complex Care", who: "Front desk", minutes: 90 },
    { date: "2026-11-04T17:00:00.000Z", label: "Sick visit", clinic: "Sick visits", who: "Physician or PA", minutes: 30 },
  ];
  assert.deepEqual(await add(p, [writeFile("old.json", old)]), ["Added old.json as Clinician A: 3 entries. It is an older backup with no saved date."]);
  const text = await card(p, 0);
  assert.match(text, /old\.json, older backup with no saved date · 3 entries/);
  // No saved date, so its weeks run from the first entry (2 Nov) to today: 10 days.
  assert.match(text, /3\.0 h logged, 2\.1 h a week\. 1\.5 h \(50%\) did not need a physician or PA\./, '"Only a physician" counts as physician work');
  assert.match(text, /Roles this page does not list, counted as other support: Front desk \(1\.5 h\)\./);
  assert.match(text, /Clinics this page does not list, counted as work assigned on top: Sick visits \(30 min\)\./);
  assert.match(text, /After hours 1\.5 h/, "after hours worked out from the start time (7pm)");
  assert.ok(await p.isVisible("#teamOdd"), "says how to map an old name with RENAMES");
  assert.deepEqual(await p.$$eval("#teamTasks li > span:first-child", (x) => x.map((y) => y.textContent)), ["Equipment letters"]);
  assert.deepEqual(p.errors, []);
});

test("text inside a team backup file is shown as text", async () => {
  const evil = '<img src=x onerror="window.pwned=1">';
  const p = await openTracker(browser);
  await team(p, "4w");
  await add(p, [backup("evil.json", [entry("2026-11-10T10:00", { label: evil, who: evil, clinic: evil })])]);
  await p.locator("#teamPeople .p-head input").fill(evil); await p.locator("#teamPeople .p-head input").press("Tab");
  assert.equal(await p.evaluate(() => window.pwned), undefined);
  assert.match(await card(p, 0), /Roles this page does not list, counted as other support: <img/s);
  assert.equal(await p.locator("#teamPeople img, #teamTasks img").count(), 0);
});

test("phone layout: all five tabs fit, and the team report does not scroll sideways", async () => {
  // Checked with the page's own fonts and with Verdana, a wide font, since phones and test machines differ.
  for (const width of [375, 320]) for (const font of ["", "Verdana"]) {
    const q = await openTracker(browser, { viewport: { width, height: 700 } });
    if (font) await q.addStyleTag({ content: `body,button{font-family:${font}!important}` });
    const [scroll, client] = await q.$eval("nav", (n) => [n.scrollWidth, n.clientWidth]);
    assert.ok(scroll <= client, `the tab row does not scroll at ${width} px ${font}`);
    await q.close();
  }
  const p = await openTracker(browser, { viewport: { width: 375, height: 812 } });
  await team(p, "4w");
  await add(p, [backup("a.json", peopleA()), backup("b.json", peopleB(), "2026-11-04T17:00"),
    backup("a-very-long-file-name-from-a-phone-share-sheet-2026-11-04.json", peopleC())]);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 375);
  for (const box of await p.$$eval("#teamPeople .person", (x) => x.map((y) => y.getBoundingClientRect().toJSON())))
    assert.ok(box.left >= 16 && box.right <= 375 - 16, "each person's card fits the screen");
  assert.ok(await p.isVisible("#copyTeam"));
});
