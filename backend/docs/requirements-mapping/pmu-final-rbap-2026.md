# Mapping — PMU-FINAL RESULTS-BASED ACTION PLAN 2026

**File:** `PMU-FINAL RESULTS-BASED ACTION PLAN 2026.xlsx`  
**Office:** Project Management Unit (Main Campus)  
**Rows:** 46 (full coverage)  
**Role:** Baseline — other workbooks document deltas only

## Block A — Basic Information (R1–R15)

| # | Source (row/label) | Requirement meaning | Prisma field | DTO field | API route(s) | Frontend component | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| A1 | `R1: "RESULTS-BASED ACTION PLAN"` | Document title (informational only) | — | — | — | — | covered | Ignored during import; used by `detectFormat()` to identify CHMSU format |
| A2 | `R2: "For FY 2026"` | Fiscal year indicator (informational) | — | — | — | — | covered | Redundant with `Plan.planningYear` at R12 |
| A3 | `R6: "Campus"` | Campus name | `Plan.campus` | `CreatePlanDto.campus` | `POST /plans`, `GET /plans/:id` | `PlanDetailModal.tsx` (editable, displayed) | covered | PMU: "Main Campus"; stored and visible |
| A4 | `R7: "Office/Unit"` | Office/unit name | `Office.name` (via `Plan.officeId`) | `CreatePlanDto.officeId` (implicit) | `POST /plans`, `GET /plans/:id` | `PlanDetailModal.tsx` (auto-derived from logged-in user) | covered | During import the office is looked up by name; office is a separate entity, not a plan field |
| A5 | `R8: "Program/Project/Activity/KRA"` | Program/project/activity/KRA classification | `Plan.programProjectActivityKRA` | `CreatePlanDto.programProjectActivityKRA` | `POST /plans`, `GET /plans/:id` | `PlanDetailModal.tsx` (editable, displayed) | covered | Stored and visible |
| A6 | `R9: "Strategic Alignment/Planning Document"` | References the strategic plan or planning document | `Plan.strategicAlignment` | `CreatePlanDto.strategicAlignment` | `POST /plans`, `GET /plans/:id` | `PlanDetailModal.tsx` (editable, displayed) | covered | Long free-text; stored and visible |
| A7 | `R10: "Breakthrough Goals"` | Breakthrough goals for the office/unit | `Plan.breakthroughGoals` | `CreatePlanDto.breakthroughGoals` | `POST /plans`, `GET /plans/:id` | `PlanDetailModal.tsx` (editable, displayed) | covered | Long free-text; stored and visible |
| A8 | `R11: "Strategic Objectives/Mandate"` | Strategic objectives or mandate statement | `Plan.strategicObjectives` | `CreatePlanDto.strategicObjectives` | `POST /plans`, `GET /plans/:id` | `PlanDetailModal.tsx` (editable, displayed) | covered | Long free-text; stored and visible |
| A9 | `R12: "Planning Year"` | Fiscal year of the plan | `Plan.planningYear` | `CreatePlanDto.planningYear` | `POST /plans`, `GET /plans/:id` | `PlanDetailModal.tsx` (editable, displayed) | covered | PMU: 2026; unique constraint `@@unique([officeId, planningYear])` |
| A10 | `R13: "Date Prepared"` | Date the plan document was prepared | `Plan.datePrepared` | `CreatePlanDto.datePrepared` | `POST /plans`, `GET /plans/:id` | `PlanDetailModal.tsx` (editable, displayed) | covered | PMU: "January 13, 2026"; stored as optional DateTime |

## Block B — Action Plan Matrix (R16–R33)

| # | Source (row/label) | Requirement meaning | Prisma field | DTO field | API route(s) | Frontend component | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| B1 | `R16 Header: "Result Level"` | Hierarchical level within the matrix (Outcome N, Output N.M) | `Goal.resultLevel` | `CreateGoalDto.resultLevel` | `POST /plans/:planId/goals`, `GET /plans/:id` (nested) | `GoalDetailModal.tsx` (editable, displayed) | covered | The CHMSU format repeats `OUTCOME N` / `OUTPUT N.M` across rows; the parser carries forward the previous non-empty value. The stored value is a flat string; hierarchical relationship (`OUTCOME → OUTPUT`) is implicit, not modelled as a parent reference. |
| B2 | `R16 Header: "Target Result (SMART)"` | Expected result stated in SMART format | `Goal.targetResult` | `CreateGoalDto.targetResult` | `POST /plans/:planId/goals`, `GET /plans/:id` (nested) | `GoalDetailModal.tsx` (editable, displayed) | covered | The CHMSU format repeats the same `targetResult` for all rows sharing an `OUTCOME N` group. The parser stores it per row (duplicated). |
| B3 | `R16 Header: "Key Actions/Activities"` | Key actions or activities to achieve the target result | `Goal.keyActions` | `CreateGoalDto.keyActions` | `POST /plans/:planId/goals`, `GET /plans/:id` (nested) | `GoalDetailModal.tsx` (editable, displayed) | covered | Bullet points with `•` prefixes; stored as plain text |
| B4 | `R16 Header: "Key Risk"` | Key risk that may impede the target | `Goal.keyRisk` | `CreateGoalDto.keyRisk` | `POST /plans/:planId/goals`, `GET /plans/:id` (nested) | `GoalDetailModal.tsx` (editable, displayed) | covered | Stored and visible |
| B5 | `R16 Header: "Mitigation/Control Measures"` | Measures to control or mitigate the risk | `Goal.mitigationMeasures` | `CreateGoalDto.mitigationMeasures` | `POST /plans/:planId/goals`, `GET /plans/:id` (nested) | `GoalDetailModal.tsx` (editable, displayed) | covered | Stored and visible |
| B6 | `R16 Header: "Key Performance Output/Outcome Indicators"` | KPI that measures progress toward the target result | `Goal.keyPerformanceIndicator` | `CreateGoalDto.kpi` | `POST /plans/:planId/goals`, `GET /plans/:id` (nested) | `GoalDetailModal.tsx` (editable, displayed) | covered | Mapped to `kpi` in the frontend form (shorter label) |
| B7 | `R16 Header: "Target"` | Quantitative or qualitative target value | `Goal.target` | `CreateGoalDto.target` | `POST /plans/:planId/goals`, `GET /plans/:id` (nested) | `GoalDetailModal.tsx` (editable, displayed) | covered | Stored and visible |
| B8 | `R16 Header: "Responsible Office/Person"` | Office or person responsible for delivery | `Goal.responsibleOfficePerson` | `CreateGoalDto.responsibleOfficePerson` | `POST /plans/:planId/goals`, `GET /plans/:id` (nested) | `GoalDetailModal.tsx` (editable, displayed) | covered | Mapped to `responsiblePerson` in the frontend form |
| B9 | `R16 Header: "Timeline"` | Implementation timeline or target date | `Goal.timeline` | `CreateGoalDto.timeline` | `POST /plans/:planId/goals`, `GET /plans/:id` (nested) | `GoalDetailModal.tsx` (editable, displayed) | covered | PMU: "2026"; stored as free-text |
| B10 | `R16 Header: "Fund Source"` | Source of funding (e.g., GAA, College Fund) | `Goal.fundSource` | `CreateGoalDto.fundSource` | `POST /plans/:planId/goals`, `GET /plans/:id` (nested) | `GoalDetailModal.tsx` (editable, displayed) | covered | Optional field; stored and visible |
| B11 | `R16 Header: "Budget Requirements"` | Total budget required for the activity | `Goal.budgetRequirements` | `CreateGoalDto.budgetRequirements` | `POST /plans/:planId/goals`, `GET /plans/:id` (nested) | `GoalDetailModal.tsx` (editable, displayed) | covered | Decimal(15,2); stored and visible |
| B12 | `R16 Header: "Budget Allocation"` | Allocated budget for the year | `Goal.budgetAllocation` | `CreateGoalDto.budgetAllocation` | `POST /plans/:planId/goals`, `GET /plans/:id` (nested) | `GoalDetailModal.tsx` (editable, displayed) | covered | Decimal(15,2); stored and visible |
| B13 | R17 rich text `[object Object]` | Merged-cell rich text artifact; contains the content of the first data row | — | — | — | — | covered | The CHMSU parser skips rows where `hasDataBeyondC1` is false AND C1 is `[object Object]`, preventing import of junk data. No data loss — the real data appears in the normal row below. |

### Row grouping (Outcome/Output)

The CHMSU workbook groups matrix rows by `Result Level`: rows with the same `OUTCOME N` label belong to one outcome, and rows labelled `OUTPUT N.M` are subordinate to that outcome. The current implementation stores a flat `Goal.resultLevel` string and does **not** model the outcome-to-output parent relationship.

**Decision:** Flat `Goal.resultLevel` is **accepted for the current phase**. A separate `Goal.parentGoalId` field or a `GoalGroup` model should be added (AUD-17-13) if hierarchical filtering/reporting becomes a requirement.

## Block C — Monitoring (R34–R42)

| # | Source (row/label) | Requirement meaning | Prisma field | DTO field | API route(s) | Frontend component | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| C1 | `R37: "Monitoring Frequency"` | How often the plan is monitored/reviewed | `Plan.monitoringFrequency` | `CreatePlanDto.monitoringFrequency` | `POST /plans`, `GET /plans/:id` | `PlanDetailModal.tsx` (editable, displayed) | covered | PMU: "Quarterly"; defaults to "Quarterly" in schema |
| C2 | `R38: "Reporting Office"` | Office responsible for reporting progress | `Plan.reportingOffice` | `CreatePlanDto.reportingOffice` | `POST /plans`, `GET /plans/:id` | `PlanDetailModal.tsx` (editable, displayed) | covered | PMU: (blank); stored as optional |

## Block D — Sign-off (R43–R46)

| # | Source (row/label) | Requirement meaning | Prisma field | DTO field | API route(s) | Frontend component | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| D1 | `R43: "Prepared by:"` | Name of the person who prepared the plan | — | — | — | — | missing | PMU: (empty); no signatory model exists. See AUD-17-05 (approval history model). |
| D2 | `R43: "Reviewed by:"` | Name of the person who reviewed the plan | — | — | — | — | missing | PMU: (empty); see AUD-17-05 |
| D3 | `R43: "Approved by:"` | Name of the person who approved the plan | — | — | — | — | missing | PMU: (empty); see AUD-17-05 |
| D4 | `R46: Role labels` (Division/Unit Head/Dean, Vice President, SUC III President) | Role titles of signatories | — | — | — | — | missing | Roles are printed on the document but not stored; could be derived from the approval flow (AUD-17-05) |

### Sign-off notes

The PMU workbook has **no names filled in** — only role titles at R46. The ICT workbook has partial names, and the QM workbook has full names. A signatory/approval model (AUD-17-05) is needed to capture prepared-by, reviewed-by, and approved-by identities as part of a plan's immutable approval history.

## Summary

| Section | Total fields | Covered | Partial | Missing |
|---|---|---|---|---|
| Block A (Basic Information) | 10 | 10 | 0 | 0 |
| Block B (Action Plan Matrix) | 13 | 13 | 0 | 0 |
| Block C (Monitoring) | 2 | 2 | 0 | 0 |
| Block D (Sign-off) | 4 | 0 | 0 | 4 |
| **Total** | **29** | **25** | **0** | **4** |
