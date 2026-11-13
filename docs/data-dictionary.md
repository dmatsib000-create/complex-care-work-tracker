# Data dictionary

All fields are preset on each button so logging is a single click. Fields can be fixed afterwards on a saved entry — nothing is locked.

| Field | Meaning | Values |
|---|---|---|
| Started / stopped | When the click-timer ran | Automatic |
| Minutes | Rounded duration, minimum 1 | Automatic, editable via manual add for forgotten work |
| Label / button | The task type tapped | Editable list — see `config/taxonomy.json` |
| Clinic | Which job this belonged to | `Complex Care` or `Non-complex Healthy Urgent` |
| Patient-facing | Was a patient/family directly involved in the moment? | Yes / No. "No" is the invisible work: forms, chasing, coordinating, documenting |
| Who could do this | The lowest-cost appropriate role that could do this work safely | Only a physician / Clerical / admin / Care coordinator / RN / MA / Social work / Pharmacist / System fix |
| Requires a doctor? | Derived: `Only a physician` = yes, everything else = no | Derived, not a separate entry burden |
| Note | Optional one line, generic only | Never PHI |

## Definitions that keep the argument clean

- **Clerical / admin:** forms, scheduling, records chasing, faxing/scanning, prior-auth paperwork assembly, prescription coordination paperwork, routine inbox routing.
- **Care coordination:** referral follow-through, DME/supplies coordination, cross-setting communication logistics, results follow-through coordination, care-plan logistics, family communication logistics that do not require clinical judgment in the moment.
- **Only a physician:** work requiring medical judgment, a clinical decision, or a physician signature that cannot be delegated under local rules. If in doubt locally, mark it physician and note why — being conservative strengthens, not weakens, the case.
