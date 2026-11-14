# Complex Care Work Tracker

A simple, modifiable tracker for a clinician in a complex care clinic to log **all** the work she does — patient-facing and invisible — and to separate:

1. **Complex care work** (her actual clinic)
2. **Non-complex, healthy urgent work** that has been assigned to her on top of it

The point is not to prove she is slow. The point is to make visible:

- the **volume** of work,
- how much of it is **not patient-facing** and therefore invisible in schedules and RVUs,
- and how much of it **does not require a doctor at all** — it is clerical and care-coordination work that a complex care clinic needs, but that should be done by clerical / care-coordination support.

> **No PHI.** Never enter patient names, MRNs, dates of birth, or identifying details. Use a short generic description only, e.g. "DME order follow-up — wheelchair" or "school form — complex patient".

## Feedback, suggestions, and bugs

Use the Google Form: https://docs.google.com/forms/d/e/1FAIpQLScd_fsY-B3A2AiI4-EwMtFP4WyT56Yk1As_pT2pULxEW0xu0A/viewform

It records feedback, suggestions, missing task buttons, and bug reports. The same link is a button at the top of `tracker.html` and in the Muse tracker page. No PHI in the form either.

## Two ways to use it

### 1. The Muse artifact (easiest)
Open the **Complex Care Work Tracker** artifact in Muse. Log entries there, edit the categories in Settings, and use the Dashboard / Report view to summarise a week or a month.

### 2. The standalone file (no account, fully yours)
Open `tracker.html` in any browser. It saves entries only in that browser (localStorage), exports CSV for the selected date range (local dates and start times), and can be edited directly — it is one self-contained file with no server. It makes no network requests: no fonts or scripts are downloaded. It uses the Atkinson Hyperlegible font if it is installed on the computer, and the system font otherwise.

The page has four tabs:

- **Track:** today's timeline (blue for work that needs a physician, highlighter yellow and orange for work support staff could do, shaded after hours) and the task buttons, grouped into "Needs a physician" and "Could be done by support staff". While a timer runs, a bar pinned to the bottom of the screen shows it with Stop and save.
- **Report:** the date range, the headline share of work that did not need a physician, the support-FTE estimate, support work by task, and a summary to copy for a supervisor.
- **Entries:** the log grouped by day, with Edit on each entry, and "Add work you forgot to time".
- **Buttons:** add, rename, re-preset, or remove task buttons.

Both use the same taxonomy in `config/taxonomy.json`.

## Make it yours — modifiability

Only the clinician doing this work knows its ins and outs, so nothing here is locked:

- **In the artifact:** Settings lets you add, rename, or remove task categories, sources, clinic types, and who-could-do-this options. Changes apply to new entries immediately.
- **In the standalone file:** The Buttons section lets you add, rename, re-preset, or remove buttons. Clinic hours (used to mark after-hours work) are `CLINIC_START_HOUR` and `CLINIC_END_HOUR` near the top of the script.
- **In this repo:** Edit `config/taxonomy.json` to change the starter lists for the standalone tracker and for future imports. Edit the lists at the top of `tracker.html` (`const TAXONOMY = ...`) to change the standalone file itself. If buttons were also changed on the page in that browser, the page keeps those and shows a "Use the file's list instead" button to switch to the file's list.
- Add categories freely. If a task does not fit, create the category on the spot and log it — a growing "Other / doesn't fit" pile is itself evidence that the taxonomy of the job is bigger than the job description.

## How it works — single click

**One click starts a timer. One click stops it and saves.** Tap a different button to switch tasks — the previous one saves automatically. There is no form to fill in at log time.

Each large button is a task type with its defaults preset (clinic, patient-facing or not, who could do it instead). She taps, works, taps again. An optional one-line note can be added afterwards, and a wrong preset can be fixed on the saved entry, but neither ever blocks the next tap.

While a timer runs she can optionally pick a source (who asked) and tick "Interrupted a visit". After hours is set automatically from the start time (before 8am, from 5pm, or weekends). Every field on a saved entry can be corrected in the log.

A manual add exists only for forgotten work: label, minutes, and the date (and optionally the start time) it actually happened, so yesterday's work can be backdated.

## What is being logged

| Field | Why it matters |
|---|---|
| Date + minutes | Volume and time are the argument |
| Clinic type: Complex Care vs Non-complex Healthy Urgent | Separates her clinic from the dumped work |
| Patient-facing? Yes / No | Makes invisible work visible |
| Task category | e.g. Forms, Prior auth, Referral coordination, DME / supplies, Scheduling, Inbox, Phone, Results, Care plan coordination, Family communication logistics, Prescriptions, Records, Visit + notes |
| Does this require a doctor? | The single most important field |
| Who could do this instead? | Clerical / admin, Care coordinator, RN, MA, Social work, Pharmacist, Only a physician, System / automation fix |
| Source / who asked | Family, School, Pharmacy, Insurer, Specialist, Inbox, Phone, Internal |
| After hours? Interrupted a visit? | Shows spillover and fragmentation |
| Notes (generic, no PHI) | One line is enough |

## Reading the results — the argument it makes

The dashboard / report answers, for any date range (Today, This week, Last 7 days, Last 4 weeks, All time, or custom dates; it opens on This week):

- **Total hours logged**, and hours per week
- **% of time that did not require a physician**
- **Hours of clerical work** and **hours of care-coordination work** done by a physician
- **Patient-facing vs non-patient-facing** split
- **Complex care vs non-complex healthy urgent** split
- **Top delegable categories** by hours
- **After-hours and interruption** counts
- A rough **support FTE translation**: delegable hours per week ÷ 40 = the fraction of a support FTE already being consumed by physician time (e.g. 12 delegable hrs/week ≈ 0.3 FTE of support work being done at physician cost and physician scarcity)

Framing for a supervisor conversation — see `docs/making-the-case.md`. The claim is:

> "This is not about speed. In [period] I logged X hours beyond visits. Y hours (Z%) did not require a physician. They were necessary for a complex care clinic — forms, coordination, authorisations, follow-up — but they were clerical and coordination work. That is Y hours a week of support work currently done by the one person who cannot be replaced in clinic. I need clerical and care-coordination support so those hours return to complex patients."

## Files

- `tracker.html` — standalone tracker, one file, works offline
- `config/taxonomy.json` — editable starter categories (single source for lists)
- `docs/data-dictionary.md` — what every field means
- `docs/making-the-case.md` — how to turn a week of logs into a short, non-defensive ask
- `docs/sample-report.md` — fill-in template for a 1-page summary to a supervisor
- `examples/example-entries.csv` — example entries (fictional, no PHI) showing the granularity to aim for

## Privacy and safety

- No PHI, ever, in either version.
- The standalone file stores data only in your browser on your device. Export CSV to back it up.
- This repo is private by default in spirit: do not publish logs containing clinic-identifying operational details without checking your employer's policies.

## Licence / ownership

Yours. Fork it, change every category, delete what does not fit. That is the intended use.
