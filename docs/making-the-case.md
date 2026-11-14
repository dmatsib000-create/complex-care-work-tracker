# Making the case

The defaults in this tracker are based on cited research reports. They are kept in the repository only in encrypted form (see `research/README.md`).

## What the data needs to show

1. **Volume:** total hours beyond (and between) visits.
2. **Invisibility:** how much was not patient-facing, so it never appears in a schedule or in work RVUs.
3. **Misallocation:** how much did not need a physician or PA, split by the role that could do it (clerical, care coordination, RN, plan case manager, and so on).
4. **Displacement:** how much was non-complex healthy urgent work taking time from complex patients.
5. **Spillover:** after-hours work and interruptions, if you log them.
6. **Unowned work:** the tasks no one on the current team is assigned to do (for example Medicaid renewal tracking, private duty nursing staffing gaps, referral loop closure).

Two to four ordinary weeks is usually enough. Do not pick your worst week: an ordinary week is more persuasive and harder to dismiss.

## Track as a team if you can

The same weeks tracked by everyone on the team is much harder to set aside than one person's log. It turns "I am overloaded" into "this is how the clinic is staffed". Each person tracks in their own browser and, at the end, sends a backup file to whoever builds the report (for example the clinical director). The Team tab combines the files without merging them into anyone's own entries, shows the figures for the team and for each person, and gives a team summary to copy. See "Tracking as a team" in the README.

Agree the weeks in advance, so no one picks a bad week. Use labels (Clinician A, B, ...) rather than names: the point is the team's pattern, not comparing people. The team summary gives the range across people, not a line each.

## What the published evidence already says

Use these as context around your own numbers. Your data is the part no study has: there is no published time study of US pediatric complex care physicians or PAs.

- **The problem is real and documented.** In ambulatory practice, physicians spent about 2 hours on EHR and desk work for every hour of face time (Sinsky 2016). In a US complex care program, unbilled care coordination took a median 2.3 hours per child per month, and physicians and NPs did 24% of it; nurses, dietitians and social workers did the rest (Ronis 2019). Practices where physicians did more of the coordination had higher costs (Antonelli 2008).
- **Complex care programs usually staff a nurse coordinator.** Published programs and program pages typically list a nurse care coordinator or case manager and a social worker alongside the clinicians.
- **Scope of practice is rarely the barrier.** Federal rules let a PA sign many of the orders a physician signs, such as Medicare DME orders and home health certification (42 CFR 410.38; 42 CFR 424.22), and many states let PAs sign most documents a physician can. RNs can generally do protocol triage, protocol refills, passing on results and the nursing care plan. What a PA or RN is actually assigned must follow both state law and your institution's policies (privileges, supervision protocols, co-signature rules). What is usually missing is assigned time, signed protocols and funding.
- **Medicaid builds in unpaid paperwork.** Home health, private duty nursing, PPEC and equipment authorizations renew on fixed cycles set by each state's Medicaid program, and the clinician's part (orders, assessments, plan of care sign-off) is often unpaid. Log it with "Auth renewals" and "HH / PDN / PPEC orders".
- **The cost of misplaced work.** Nationally, an hour of a general pediatrician's wage costs about 4.6 times an hour of a medical assistant's and about twice an RN's (BLS OEWS, May 2025, wages only). Benefits change the ratio somewhat.
- **Savings go to payers; costs stay with the program.** Complex care programs have cut hospital use and total cost while running at a loss themselves (Gordon 2007; Mosquera 2014). That is an argument for institutional or contract funding, not for billing harder.
- **Funding routes to ask about.** Medicaid health homes for children with medical complexity under the ACE Kids Act (Social Security Act section 1945A), and any care coordination terms in your state's Medicaid managed care contracts.

## What not to say

- Do not frame it as "I am slow, behind, or inefficient." Speed is not the variable the data measures.
- Do not frame it as a complaint about colleagues. Frame it as a staffing design question for a complex clinic, and as making the program sustainable.

## A short script

> I tracked all of my work for [period], patient-facing and not, with a one-click timer. I logged [X] hours in total. [Y] hours, [Z]%, did not need a physician or PA. They were necessary for a complex care clinic: [top 2 or 3 delegable categories]. [A] hours could have been done by an RN, [B] hours were care coordination and [C] hours were clerical. [D] hours were non-complex healthy urgent work on top of complex care.
>
> That is roughly [Y / weeks] hours a week of support work currently done by a physician, about [fraction] of a support FTE, at physician cost. Published complex care programs give this work to a nurse care coordinator. I am asking for (1) protocol-backed RN time assigned to this clinic, (2) a dedicated RN care coordinator, and (3) clerical support for authorizations and renewals, so those hours go back to complex patients.

For a team, the Team tab's summary gives the same sentences in the plural. The script becomes:

> [N] of us tracked all of our work for the same [period]. Together we logged [X] hours, and [Y] hours, [Z]%, did not need a physician or PA. Across the team that is about [Y / weeks] hours a week of support work, roughly [fraction] of a support FTE, and it was [low] to [high] hours a week for each of us. This is not one person's workload; it is how the clinic is staffed.

The order of the asks is an inference, not a tested finding. Let your own data decide: if calls, triage and results dominate the support hours, the RN asks come first; if forms, authorizations and renewals dominate, clerical support may return more physician time per dollar.

## Bring

- The 1-page summary (`sample-report.md`, filled in)
- The CSV export as backup, not as the opening move
- 3 to 5 concrete, generic examples (no PHI): for example "One private duty nursing staffing gap took 3 calls and 24 minutes, none of which needed a doctor"

## Key references

- Sinsky C, et al. Allocation of physician time in ambulatory practice: a time and motion study in 4 specialties. *Ann Intern Med*. 2016;165(11):753-760. doi:10.7326/M16-0961
- Ronis SD, et al. Estimated nonreimbursed costs for care coordination for children with medical complexity. *Pediatrics*. 2019;143(1):e20173562. doi:10.1542/peds.2017-3562
- Antonelli RC, Stille CJ, Antonelli DM. Care coordination for children and youth with special health care needs: a descriptive, multisite study of activities, personnel costs, and outcomes. *Pediatrics*. 2008;122(1):e209-e216. doi:10.1542/peds.2007-2254
- Gordon JB, et al. A tertiary care-primary care partnership model for medically complex and fragile children and youth with special health care needs. *Arch Pediatr Adolesc Med*. 2007;161(10):937-944. doi:10.1001/archpedi.161.10.937
- Mosquera RA, et al. Effect of an enhanced medical home on serious illness and cost of care among high-risk children with chronic illness: a randomized clinical trial. *JAMA*. 2014;312(24):2640-2648. doi:10.1001/jama.2014.16419
- Berry JG, et al. Children with medical complexity and Medicaid: spending and cost savings. *Health Aff*. 2014;33(12):2199-2206. doi:10.1377/hlthaff.2014.0828
- 42 CFR 410.38 (Medicare DME orders); 42 CFR 424.22 (home health certification)
- US Bureau of Labor Statistics. Occupational Employment and Wages, May 2025 (released May 15, 2026)
