// The task list lives in two places: the TAXONOMY list at the top of tracker.html (what the page uses)
// and config/taxonomy.json (the documented starter list). This test fails if they drift apart.
// No browser needed: it reads the lists straight out of the file.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "tracker.html"), "utf8");
const json = JSON.parse(fs.readFileSync(path.join(root, "config", "taxonomy.json"), "utf8"));

// Run the SETTINGS block from the page's script (the names, TAXONOMY and the option lists) and return its values.
function settings() {
  const m = html.match(/\/\/ =+ SETTINGS START =+([\s\S]*?)\/\/ =+ SETTINGS END =+/);
  assert.ok(m, "SETTINGS START / SETTINGS END markers not found in tracker.html");
  return new Function(`${m[1]}; return { TAXONOMY, CLINICS, WHO_OPTIONS, SOURCES, PHYSICIAN, CLERICAL, COORDINATOR, NURSE, SOCIAL, COMPLEX, URGENT, RENAMES };`)();
}
const page = settings();
const fromPage = (name) => page[name];

test("buttons match config/taxonomy.json", () => {
  const page = fromPage("TAXONOMY");
  const file = json.buttons.map((b) => ({ label: b.label, clinic: b.clinic, facing: b.patient_facing, who: b.who_could_do }));
  assert.deepEqual(page, file);
});

test("dropdown lists match config/taxonomy.json", () => {
  assert.deepEqual(fromPage("CLINICS"), json.clinic_types);
  assert.deepEqual(fromPage("WHO_OPTIONS"), json.who_could_do_options);
  assert.deepEqual(fromPage("SOURCES"), json.sources);
});

test("the names the logic depends on are in the option lists", () => {
  assert.ok(page.WHO_OPTIONS.includes(page.PHYSICIAN));
  assert.ok(page.WHO_OPTIONS.includes(page.CLERICAL));
  assert.ok(page.WHO_OPTIONS.includes(page.COORDINATOR));
  assert.ok(page.WHO_OPTIONS.includes(page.NURSE));
  assert.ok(page.WHO_OPTIONS.includes(page.SOCIAL));
  assert.ok(page.CLINICS.includes(page.COMPLEX));
  assert.ok(page.CLINICS.includes(page.URGENT));
});

test("every button uses a known clinic and role", () => {
  const clinics = new Set(json.clinic_types), roles = new Set(json.who_could_do_options);
  for (const b of json.buttons) {
    assert.ok(clinics.has(b.clinic), `${b.label}: unknown clinic ${b.clinic}`);
    assert.ok(roles.has(b.who_could_do), `${b.label}: unknown role ${b.who_could_do}`);
    assert.deepEqual(Object.keys(b).sort(), ["clinic", "label", "patient_facing", "who_could_do"], `${b.label}: unexpected fields`);
  }
});
