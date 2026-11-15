# Data dictionary

All fields are preset on each button so logging is a single click. Fields can be fixed afterwards on a saved entry: nothing is locked.

| Field | Meaning | Values |
|---|---|---|
| Started / stopped | When the click-timer ran | Automatic |
| Minutes | Rounded duration, minimum 1 | Automatic, editable via manual add for forgotten work |
| Start time | When the work started | Automatic for timed work. Work added by hand without a time shows "No time" and has a blank `start_time` in the CSV |
| Label / button | The task type tapped | Editable list; see `config/taxonomy.json` |
| Clinic | Which job this belonged to | `Complex Care` or `Non-complex Healthy Urgent` |
| Patient-facing | Was a patient/family directly involved in the moment? | Yes / No. "No" is the invisible work: forms, chasing, coordinating, documenting |
| Who could do this | The lowest-cost appropriate role that could do this work safely | Physician or PA / Clerical / admin / Care coordinator / RN / MA / Social work / Pharmacist / Plan case manager / System fix |
| Needs a clinician? | Derived: `Physician or PA` = yes, everything else = support work | Derived, not a separate entry burden. Entries saved as `Only a physician` by earlier versions are renamed automatically |
| Source / who asked | Who the work came from | Family / School / Pharmacy / Insurer / Specialist / Inbox / Phone / Internal / Walk-in. Optional; pick it while the timer runs or later in the log |
| After hours | Work started before clinic hours, after them, or on a weekend | Automatic from the start time (default clinic hours 8am to 5pm, weekdays). Can be changed on the entry |
| Needed a clinician | This instance of a support task needed a physician or PA (for example a call where a clinical decision was made) | Tick it while the timer runs (support tasks only); the entry is saved as "Physician or PA". Change it later with "Who could do this" in the log |
| Interrupted a visit | This task pulled her out of, or broke into, a patient visit | Yes / No. Tick it while the timer runs or later in the log |
| Note | Optional one line, generic only | Never PHI |
| Last edited | When the entry was last changed in the log | Automatic. When a backup is restored, the more recently edited copy of an entry is kept |
| Deleted | Which entries were deleted, and when (kept separately from the entries, and in backup files) | Automatic. A deleted entry is not brought back by a restore, and a restore removes entries deleted on the device the backup came from, unless the entry was edited after it was deleted |

## Definitions that keep the argument clean

These definitions come from cited research kept in encrypted form in this repository (see `research/README.md`). Each split is one of three kinds: a law or payer rule, published evidence, or professional convention. Much of it is convention. What any role may do is set by state law and, within it, by the employer's policies; check both before relying on a default.

- **Physician or PA:** work that needs a clinician: making or changing a clinical decision, abnormal results, goals-of-care and other high-stakes conversations, clinician-to-clinician reasoning (peer-to-peer reviews, hospital consults), and signing orders and certifications. Federal rules let a PA sign many orders a physician signs (for example Medicare DME orders and home health certification, 42 CFR 410.38 and 424.22), and many states let PAs sign most documents a physician can. What a particular PA is assigned depends on state law, the PA's privileges, the supervision protocol and institutional rules on co-signature and prescribing. So the line that matters here is clinician versus support staff; how the physician and PA divide clinician work is a separate question. If in doubt, mark it clinician and note why; being conservative strengthens the case.
- **RN:** protocol phone triage, refills of non-controlled medicines under a signed protocol, passing on results the clinician has already classified as normal, the nursing plan of care, device teaching, and drafting home health, PDN and PPEC assessment narratives for a clinician to sign. These generally sit within RN scope; an RN in a coaching or education role holds the same license, so moving this work to them is usually a job-description and protocol change. Check your state's nursing rules and institutional policy.
- **Care coordinator:** referral loop closure, DME and supply vendor coordination, the shared plan of care, school, specialist and agency traffic, and being the family's single point of contact. Published complex care programs give most of this to nurse coordinators (Ronis 2019; Antonelli 2008).
- **Clerical / admin:** forms (pre-filling and tracking; the clinician signs), prior auth submission and tracking, the Medicaid renewal calendar, scheduling, records chasing, faxing and scanning, pharmacy logistics, routine inbox routing.
- **MA:** rooming, pre-visit planning, pre-filling forms, taking messages. Medical assistants generally work under clinician supervision and do not triage.
- **Plan case manager:** work the child's Medicaid plan or care management program is contracted to do, such as coordinating private duty nursing coverage. Logging it shows how much plan work lands on the clinic.

## Which button for which work

| Work | Button | Default role | Why |
|---|---|---|---|
| Family calls: triage, updates, logistics | Phone with family | RN | Protocol triage is RN scope. If a clinical decision is made, tick "Needed a clinician" while timing (decisions stay with a clinician; convention) |
| Peer-to-peer review or the clinical argument for a denial | Peer-to-peer / appeal | Physician or PA | Plans must let the requesting provider argue the case (42 CFR 438.210) |
| Prior auth paperwork, submission and tracking | Prior auth | Clerical / admin | Paperwork, not the decision |
| Tracking Medicaid renewals for home health, private duty nursing (PDN), PPEC, therapy and equipment prescriptions | Auth renewals | Clerical / admin | Calendar-driven and predictable |
| Home health, PDN or PPEC orders, plans of care, assessment narratives | HH / PDN / PPEC orders | RN | An RN can draft and review; the clinician signs. Tick "Needed a clinician" if the assessment or signing took real clinician time. The clinician's part is often unpaid |
| Chasing missed PDN or PPEC shifts | PDN shift gaps | Plan case manager | Medicaid plans and care management programs are often contracted to coordinate this |
| Relaying results, closing the loop, family questions after results reach the portal | Results follow-up | RN | Relaying classified results is RN scope; tick "Needed a clinician" when an abnormal result needed interpreting |
