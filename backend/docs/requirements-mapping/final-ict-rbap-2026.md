# Mapping — Final-ICT-RBAP-2026-03022026

**File:** `Final-ICT-RBAP-2026-03022026.xlsx`  
**Office:** Information and Communication Technology Unit / Information Technology Services Unit  
**Rows:** 1000 (full file); 48 in trimmed fixture  
**Role:** Delta from PMU baseline

## Structure assessment

**Same structure as PMU-FINAL.** Row ranges, column layout, section boundaries, and column headers are identical to `PMU-FINAL RESULTS-BASED ACTION PLAN 2026.xlsx`. The complete PMU mapping (`pmu-final-rbap-2026.md`) applies directly.

## Deltas

| # | Source | PMU baseline | ICT value | Mapping impact | Status |
|---|---|---|---|---|---|
| 1 | `R6: Campus` | Main Campus | Main Campus | Same value; no change | covered |
| 2 | `R7: Office/Unit` | Planning and Monitoring Unit | Information and Communication Technology Unit / Information Technology Services Unit | Different name; resolved at import via office lookup by name | covered |
| 3 | `R13: Date Prepared` | January 13, 2026 | (empty in inspected fixture) | Date may be missing; parser handles missing dates gracefully (`datePrepared` optional) | covered |
| 4 | Sign-off names (R43–R46) | All blank | Prepared: `ARIANE M. TORRES, MIT`; Reviewed: (blank); Approved: `NORBERTO P. MANGULABNAN, PhD` | Names exist in the workbook but are not stored (see AUD-17-05) | missing |
| 5 | Sign-off roles (R46) | Division/Unit Head/Dean, Vice President, SUC III President | Division/Unit Head/Dean, —, SUC III President | Similar role structure | missing |

## Confirmed identical columns

All 12 matrix columns (Result Level, Target Result, Key Actions/Activities, Key Risk, Mitigation, KPI, Target, Responsible Office/Person, Timeline, Fund Source, Budget Requirements, Budget Allocation) and all 8 Basic Information fields have the same positions and semantics as the PMU workbook. No new columns or fields were found.

## Row-range consistency

Confirmed against `workbook-structure-notes.md`:
- Block A: R1–R15 ✓
- Block B: R16 (header), R17–R33 (data; R17 rich text skipped) ✓
- Block C: R34–R42 ✓
- Block D: R43–R46 ✓

No structural deviations found.
