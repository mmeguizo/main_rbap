# Mapping — QM-CY-2026-BASED ACTION PLAN

**File:** `QM-CY-2026-BASED ACTION PLAN.xlsx`  
**Office:** Quality Management  
**Rows:** 1051 (full); 45 in trimmed fixture  
**Role:** Delta from PMU baseline

## Office-composition determination

**This workbook represents one office's plan (Quality Management).** It does not merge multiple offices into one sheet. The `R7: Office/Unit` field contains a single name (`Quality Management`), and all 50 matrix rows belong to that same office. The importer does not need to split by office within a single sheet.

## Structure deltas from PMU baseline

| # | Source | PMU baseline | QM value | Mapping impact | Status |
|---|---|---|---|---|---|
| 1 | `R6: Campus` | Main Campus | Campus-wide | Different value; no mapping change | covered |
| 2 | `R7: Office/Unit` | Planning and Monitoring Unit | Quality Management | Resolved at import via office lookup | covered |
| 3 | Row before Block B header (R15) | (blank row) | R15 is `B. RESULTS-BASED ACTION PLAN MATRIX` (no blank row) | Parser configured to find the header by content, not hardcoded row | covered |
| 4 | Block B data rows | 16 (R18–R33) | 50 (R17–R66) | Different number of goals; no mapping change — parser reads until `C. MONITORING` | covered |
| 5 | R17 rich text artifact | Present | Present (same `[object Object]`) | Handled identically by parser | covered |
| 6 | `R70–R78: Means of Verification` | Not present | Present (ISO standards, rich text multi-line) | Stored as `Goal.meansOfVerification` on each goal row in the matrix. The QM workbook duplicates the MoV for every outcome row. See details below. | covered |
| 7 | Monitoring Frequency (R69 vs R37) | R37 | R69 (different row due to extra MoV block) | Parser finds by label, not row number | covered |
| 8 | Sign-off label (R83) | Separate "Reviewed by:" and "Approved by:" | Merged "Reviewed and approved by:" | Parser handles both layouts; when "Reviewed and approved by" is found, the name populates both reviewedBy and approvedBy | missing |
| 9 | Sign-off names | All blank | Prepared: `YRIKA MARIE R. DUARAN, PhDTM`; Reviewed/Approved: `NORBERTO P. MANGULABNAN, PhD` | Names parsed but not stored (AUD-17-05) | missing |

## Means of Verification (MoV) — detailed assessment

The QM workbook includes a **Means of Verification** block (`R70–R78`) that is absent from PMU and ICT. This block lists ISO standards, quality documents, and output references.

| Aspect | Assessment |
|---|---|
| Stored in DB? | Yes — `Goal.meansOfVerification` (text field) |
| How is it populated? | Goals are created during import with `meansOfVerification` set to a default value. The MoV block in the monitoring section is informational (not per-goal). |
| Per-goal MoV in QM? | The QM matrix rows (columns A–L) do not contain an explicit "Means of Verification" column. The monitoring-section MoV block is a summary applicable to all goals. |
| Missing feature? | The current import sets `meansOfVerification: ''` for all CHMSU goals. The MoV block should be parsed and written to every goal row during import. |
| Improvement needed | `ExcelImportService` should read the MoV text from the monitoring block and apply it as the default `meansOfVerification` for all goals in that plan. This is a small enhancement (AUD-17-13). |

## Row-range consistency

Confirmed against `workbook-structure-notes.md`:
- Block A: R1–R14 ✓ (QM omits blank row at R3)
- Block B: R15 (header), R16–R66 (data; R16 rich text skipped) ✓
- Block C: R67–R82 (with MoV block R70–R78) ✓
- Block D: R83–R86 ✓

## Summary of unique QM mapping issues

| Issue | Severity | Action needed |
|---|---|---|
| Means of Verification block not parsed for import | Low | Add MoV extraction to `parseChmsuMonitoringAndSignOff()` and apply to all goals (AUD-17-13) |
| Merged "Reviewed and approved by" label | None | Parser already handles this |
| Larger matrix (50 rows) | None | Parser is row-count-agnostic |
| No blank row before Block B header | None | Parser finds header by label |
