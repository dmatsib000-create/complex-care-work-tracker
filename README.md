# Complex Care Work Tracker

**Open the tracker:** https://dmatsib000-create.github.io/complex-care-work-tracker/tracker.html

Bookmark that link on each phone and computer she uses. Entries are saved in that browser only; use Save backup file (the line under the title) to keep them safe or move them to another device.

A simple, modifiable tracker for a clinician in a complex care clinic to log **all** the work she does (patient-facing and invisible) and to separate:

1. **Complex care work** (her actual clinic)
2. **Non-complex, healthy urgent work** that has been assigned to her on top of it

The point is not to prove she is slow. The point is to make visible:

- the **volume** of work,
- how much of it is **not patient-facing** and therefore invisible in schedules and RVUs,
- and how much of it **does not need a physician or PA at all**: it is nursing, care-coordination and clerical work that a complex care clinic needs, but that should be done by support staff.

The defaults (which tasks need a clinician, which role could do the rest) come from cited research: see "Research behind the defaults" below.

> **No PHI.** Never enter patient names, MRNs, dates of birth, or identifying details. Use a short generic description only, e.g. "DME order follow-up, wheelchair" or "school form, complex patient".

## Feedback, suggestions, and bugs

Use the Google Form: https://docs.google.com/forms/d/e/1FAIpQLScd_fsY-B3A2AiI4-EwMtFP4WyT56Yk1As_pT2pULxEW0xu0A/viewform

It records feedback, suggestions, missing task buttons, and bug reports. The same link is at the top of the tracker (in the footer on phones). No PHI in the form either.

## How to use it

### The tracker page (use this one)
Open https://dmatsib000-create.github.io/complex-care-work-tracker/tracker.html, or download `tracker.html` and open it in any browser; it is the same page. A downloaded copy keeps its own separate entries, so pick one way and stick to it (or move entries with a backup file).

The page saves entries only in the browser it is opened in (localStorage), exports CSV for the selected date range (local dates and start times), and can be edited directly: it is one self-contained file with no server. It makes no network requests: no fonts or scripts are downloaded. It uses the Atkinson Hyperlegible font if it is installed on the computer, and the system font otherwise.

The page has four tabs:

- **Track:** today's timeline (blue for work that needs a physician or PA, highlighter yellow and orange for work support staff could do, shaded after hours) and the task buttons, grouped into "Needs a physician or PA" and "Could be done by support staff". While a timer runs, a bar pinned to the bottom of the screen shows it with Stop and save.
- **Report:** the date range, the headline share of work that did not need a physician or PA, the support-FTE estimate, support work by task, and a summary to copy for a supervisor.
- **Entries:** the log grouped by day, with Edit on each entry, and "Add work you forgot to time".
- **Buttons:** add, rename, re-preset, or remove task buttons.

The starter task list is in `config/taxonomy.json` and in the `TAXONOMY` list at the top of `tracker.html`. Keep the two the same; `npm test` checks that they match.

### Earlier Muse artifact (separate, not kept up to date)
An earlier version was built as a Muse artifact. It is separate from this repository and does not have the fixes and features here (local dates, per-week figures, backups, and so on). Use the tracker page above instead.

## Make it yours: modifiability

Only the clinician doing this work knows its ins and outs, so nothing here is locked.

**On the page (no editing files):** the Buttons tab adds, renames, re-presets, or removes task buttons. These changes are saved in that browser and travel in backup files. If the page's buttons differ from the file's list, a "Use the file's list instead" button switches back.

**In `tracker.html`:** everything meant to be edited is in one block at the top of the script, between `SETTINGS START` and `SETTINGS END`:

- `TAXONOMY`: the starter task buttons.
- `CLINICS`, `WHO_OPTIONS`, `SOURCES`: the dropdown options. Roles other than the three named below (RN, MA, Social work, ...) can be added, renamed or removed freely.
- `CLINIC_START_HOUR`, `CLINIC_END_HOUR`: clinic hours, used to mark after-hours work.
- `LONG_TIMER_MIN`: how long a timer can run before she is asked whether it was left on. A panel then lets her save the real time (minutes like `45`, or `1:30`), discard it, or keep timing.
- `PHYSICIAN`, `CLERICAL`, `COORDINATOR`, `COMPLEX`, `URGENT`: the names the report depends on. `PHYSICIAN` ("Physician or PA") decides what counts as needing a clinician (everything else is support work), `CLERICAL` and `COORDINATOR` are the two support totals, and anything not in `COMPLEX` counts as work assigned on top.

**Renaming one of those five names:** change it in its line (for example `const CLERICAL = "Front desk";`), then add the old name to `RENAMES` so entries saved under it follow:

```
const RENAMES = { "Clerical / admin": "Front desk" };
```

If a settings edit would make the report wrong, the page shows a yellow "Check the settings" notice listing what to fix, including the exact line to add to `RENAMES`. It catches:

- a renamed key name (any of the five above) whose old name is still on saved entries, on buttons changed on the page, or on a running timer;
- a key name missing from `WHO_OPTIONS` or `CLINICS`;
- a `RENAMES` line that leads to a name not in the lists;
- a starter button using a role or clinic that is not in the lists.

Renamed values are saved as soon as the page opens, so the `RENAMES` line can be removed afterwards on that device; keep it if the tracker is used on other devices or old backups may be restored. Other roles (RN, MA, ...) can be removed from `WHO_OPTIONS` without a notice: entries that used them still count as other support work.

Keep `config/taxonomy.json` the same as the settings block; `npm test` checks that they match.

Add categories freely. If a task does not fit, create the category on the spot and log it: a growing "Other / doesn't fit" pile is itself evidence that the job is bigger than the job description.

## How it works: single click

**One click starts a timer. One click stops it and saves.** Tap a different button to switch tasks; the previous one saves automatically. There is no form to fill in at log time.

Each large button is a task type with its defaults preset (clinic, patient-facing or not, who could do it instead). She taps, works, taps again. An optional one-line note can be added afterwards, and a wrong preset can be fixed on the saved entry, but neither ever blocks the next tap.

While a timer runs she can optionally pick a source (who asked) and tick "Interrupted a visit". On a support task she can also tick "Needed a clinician" when this one needed a physician or PA (for example a call where a clinical decision was made); that entry then counts as clinician work. After hours is set automatically from the start time (before 8am, from 5pm, or weekends). Every field on a saved entry can be corrected in the log.

A manual add exists only for forgotten work: label, minutes, and the date (and optionally the start time) it actually happened, so yesterday's work can be backdated.

## What is being logged

| Field | Why it matters |
|---|---|
| Date + minutes | Volume and time are the argument |
| Clinic type: Complex Care vs Non-complex Healthy Urgent | Separates her clinic from the dumped work |
| Patient-facing? Yes / No | Makes invisible work visible |
| Task category | e.g. Visit, Inbox, Notes, Peer-to-peer / appeal, Phone with family, Results follow-up, HH / PDN / PPEC orders, PDN shift gaps, Referral coordination, DME / supplies, Care plan coordination, Forms, Prior auth, Auth renewals, Prescriptions, Scheduling, Records |
| Does this need a physician or PA? | The single most important field |
| Who could do this instead? | Physician or PA, Clerical / admin, Care coordinator, RN, MA, Social work, Pharmacist, Plan case manager, System / automation fix |
| Source / who asked | Family, School, Pharmacy, Insurer, Specialist, Inbox, Phone, Internal |
| After hours? Interrupted a visit? | Shows spillover and fragmentation |
| Notes (generic, no PHI) | One line is enough |

## Reading the results: the argument it makes

The dashboard / report answers, for any date range (Today, This week, Last 7 days, Last 4 weeks, All time, or custom dates; it opens on This week):

- **Total hours logged**, and hours per week
- **% of time that did not need a physician or PA**
- **Hours of clerical work** and **hours of care-coordination work** done by a physician
- **Patient-facing vs non-patient-facing** split
- **Complex care vs non-complex healthy urgent** split
- **Top delegable categories** by hours
- **After-hours and interruption** counts
- A rough **support FTE translation**: delegable hours per week ÷ 40 = the fraction of a support FTE already being consumed by physician time (e.g. 12 delegable hrs/week ≈ 0.3 FTE of support work being done at physician cost and physician scarcity). Weeks are counted from the first day she logged anything, so choosing a long range early on does not water the figure down; it appears once a full week has been logged.

Framing for a supervisor conversation: see `docs/making-the-case.md`. The claim is:

> "This is not about speed. In [period] I logged X hours beyond visits. Y hours (Z%) did not need a physician or PA. They were necessary for a complex care clinic (forms, coordination, authorisations, triage, follow-up), but they were nursing, coordination and clerical work. That is Y hours a week of support work currently done by the one person who cannot be replaced in clinic. I need dedicated nursing, care-coordination and clerical support so those hours return to complex patients."

## Research behind the defaults

Cited research reports set the starter buttons and roles. They are kept in the repository only in encrypted form (see `research/README.md`). In short:

- **"Physician or PA", not "Only a physician".** Federal rules and many state laws let a PA sign many of the orders and forms a physician signs, so the line that matters for staffing is clinician versus support staff. What a PA is actually assigned follows state law and the employer's policies (privileges, supervision protocol, co-signature rules). Entries saved as "Only a physician" by earlier versions are renamed automatically.
- **Calls default to RN, with a tick for decisions.** "Phone with family" and "Results follow-up" default to RN, because protocol triage and relaying classified results are generally RN scope. She often cannot know when a call starts whether it will need a decision, so instead of a separate button she ticks "Needed a clinician" in the timer bar and that call counts as clinician work.
- **Prior auth is split.** The peer-to-peer and clinical argument need a clinician; paperwork and the renewal calendar ("Prior auth", "Auth renewals") are clerical.
- **Medicaid renewal cycles get their own buttons.** "HH / PDN / PPEC orders" (home health, private duty nursing and PPEC orders and plans of care; an RN can draft, the clinician signs) and "PDN shift gaps" (the Medicaid plan's case manager is contracted to coordinate this; logged as "Plan case manager").
- **The buttons are ordered by role, and each role has its own highlighter:** aqua for RN, orange for care coordinator, yellow for clerical, pink for other roles such as the plan case manager. The three main colours match the three staffing asks.

Each split is labeled in the reports as a law or payer rule, published evidence, or professional convention. Change any default to fit the clinic.

## Files

- `tracker.html`: the tracker. One file, works offline, nothing to install
- `config/taxonomy.json`: the starter task list and dropdown options (must match `TAXONOMY` in `tracker.html`)
- `tests/`: automated browser tests (see Testing)
- `package.json`, `package-lock.json`: only used to run the tests
- `.github/workflows/test.yml`: runs the tests on GitHub
- `docs/data-dictionary.md`: what every field means, and which button to use for which work
- `docs/making-the-case.md`: how to turn a week of logs into a short, non-defensive ask, with cited evidence
- `docs/sample-report.md`: fill-in template for a 1-page summary to a supervisor
- `examples/example-entries.csv`: example entries (fictional, no PHI) showing the granularity to aim for
- `research/`: the research behind the defaults, encrypted (see `research/README.md`)
- `scripts/`: encrypt, decrypt and check the research archive

## Testing

The tests open `tracker.html` in a headless browser and check timing, the report figures, editing, backups, two open tabs, phone layout, and that the task list matches `config/taxonomy.json`. They use a fixed clock (a Wednesday morning, Pacific time), so results do not depend on the day they run.

```
npm install
npx playwright install chromium
npm test
```

They also run automatically on GitHub for every pull request and after each merge to `main` (`.github/workflows/test.yml`). `main` is what GitHub Pages publishes, so do not merge a pull request whose Tests check is red.

## Privacy and safety

- No PHI, ever, in either version.
- The standalone file stores data only in your browser on your device. Nothing is sent anywhere.
- **Back it up:** the line under the title, on every tab, says how many entries, and whether any button changes, are not in a backup yet. It turns amber, with a Save backup file button, once work that is not backed up is 2 days old. Back up or restore opens the backup panel. Saving makes one small `.json` file with every entry (and your button changes). On a computer it goes to Downloads; on a phone the share sheet opens so it can be emailed or saved to Files or a cloud drive. Keep it somewhere other than the device, such as your email or a cloud drive.
- **Move to another device or browser:** open the tracker there, then Restore from a backup file (on a new browser it is offered right under the title). New entries are added. An entry that is already there is replaced only if the backup's copy was edited more recently, so restoring the same file twice is harmless. Deleting an entry on one device does not delete it from another.
- **Work computers:** some hospital computers erase browser data when you sign out. On those, save a backup file at the end of each session.
- **iPhone / Safari:** Safari can clear a website's saved data if the site is not opened for about a week. Save backups regularly. Adding the page to the Home Screen avoids this, but the Home Screen icon keeps its own entries, separate from Safari: save a backup in Safari and restore it in the Home Screen version to switch.
- This repo is private by default in spirit: do not publish logs containing clinic-identifying operational details without checking your employer's policies.

## Licence / ownership

Yours. Fork it, change every category, delete what does not fit. That is the intended use.
