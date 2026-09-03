# Missing-Fields Summary

Consolidated backlog of all `missing` and `partial` entries from the three workbook mapping documents (`pmu-final-rbap-2026.md`, `final-ict-rbap-2026.md`, `qm-cy-2026-action-plan.md`).

| # | Field | Workbooks | Status | Proposed fix | Task ref | Notes |
|---|---|---|---|---|---|---|
| 1 | Sign-off: Prepared by name | PMU (blank), ICT (filled), QM (filled) | missing | Add an approval/signatory model or extend Plan with `preparedById` / `reviewedById` / `approvedById` as optional FK fields. If names are external (not app users), store as text in an immutable approval-history record. | AUD-17-05 | The CHMSU parser already extracts these names; they just need a storage model. |
| 2 | Sign-off: Reviewed by name | PMU (blank), ICT (blank), QM (merged with approved) | missing | Same as #1. In QM, "Reviewed and approved by" merges two roles — decide whether the model needs a shared or separate field. | AUD-17-05 | Parser already handles merged label. |
| 3 | Sign-off: Approved by name | PMU (blank), ICT (filled), QM (merged with reviewed) | missing | Same as #1. | AUD-17-05 | — |
| 4 | Sign-off: Role titles (Division/Unit Head/Dean, Vice President, SUC III President) | All three (blank names, roles present) | missing | If not derived from the approval flow (e.g., the `User.role` of the approving user), store as text on the signatory record. | AUD-17-05 | Roles may be unnecessary if the system derives them from the approval user's current role. |
| 5 | Means of Verification on CHMSU-imported goals | QM only (MoV block R70–R78) | partial | The CHMSU parser's `parseChmsuMonitoringAndSignOff()` already extracts `meansOfVerification`. Apply the extracted text to all goals created during `parseChmsuMatrixRows()` for QM workbooks. | IMP-01 | Only QM has an MoV block. PMU and ICT do not — goals from those workbooks will continue to have empty `meansOfVerification`. The field itself (`Goal.meansOfVerification`) is fully covered in schema, DTO, API, and UI. |

## By task

| Task | Missing/partial entries addressed | Effort |
|---|---|---|
| AUD-17-05 (Approval history model) | #1, #2, #3, #4 — 4 signatory fields | 1–2 days (new model, migration, service, UI) |
| IMP-01 (Importer improvements) | #5 — MoV applied during CHMSU import | ~15 min (one `if` block in `parseChmsuMatrixRows`) |

## Status breakdown

| Category | Count |
|---|---|
| Missing (no DB storage) | 4 |
| Partial (stored but not populated by importer) | 1 |
| **Total backlog items** | **5** |

All other fields across all three workbooks (25 of 30 unique fields) are **covered** end-to-end: in the DB schema, DTO, API route, and frontend component.
