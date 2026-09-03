# Workbook Structure Notes — AUD-17-02-a

## Summary

Three real Excel workbooks were inspected to document the exact row structure, column layout, and section boundaries. These notes drive the preprocessing logic for `plans.service.ts` import.

---

## Workbook Common Structure

All three follow this layout:

| Block | Rows (PMU) | Rows (ICT) | Rows (QM) |
|---|---|---|---|
| A. Basic Information | 1–15 | 1–15 | 1–14 |
| B. Action Plan Matrix | 16–33 | 16–33 | 15–66 |
| C. Monitoring | 34–42 | 34–42 | 67–82 |
| Sign-off | 43–46 | 43–46 | 83–86 |

### Column Counts
- **PMU**: 16 columns (but only ~12 carry data)
- **ICT**: 26 columns (but only ~12 carry data)
- **QM**: 26 columns

---

## Block A — Basic Information (R1-R15)

All three share the same structure:

```
R1:  RESULTS-BASED ACTION PLAN                (merged across all cols)
R2:  For FY 2026                              (merged across all cols)
R4:  A. BASIC INFORMATION                      (section header)
R5:  ITEM | ITEM | DETAILS (×10+)             (merged header)
R6:  Campus | Campus | <value per office>      [PMU: "Main Campus", QM: "Campus-wide"]
R7:  Office/Unit | Office/Unit | <name>        [PMU: "Planning and Monitoring Unit", ICT: "Information and Communication Technology Unit / Information Technology Services Unit", QM: "Quality Management"]
R8:  Program/Project/Activity/KRA | ... | <value>
R9:  Strategic Alignment/Planning Document | ... | <CHMSU Strategic Plan...>
R10: Breakthrough Goals | ... | <text>
R11: Strategic Objectives/Mandate | ... | <SO1. ...>
R12: Planning Year | ... | 2026
R13: Date Prepared | ... | <date string>       [e.g. "January 13, 2026"]
R15: B. RESULTS-BASED ACTION PLAN MATRIX       (section header) [PMU/ICT only — QM at R15]
```

**Key observation**: All metadata cells are **merged** C1:C2 for labels, then C3:C~12 for values. The value repeats across merged columns.

### Fields extractable from Block A
| DB Field | Row | Notes |
|---|---|---|
| `office_name` | R7 | Already stored in offices table — skip during import |
| `campus` | R6 | May be useful for validation |
| `program` | R8 | Free-text |
| `strategic_alignment` | R9 | Free-text (long) |
| `breakthrough_goals` | R10 | Free-text (long) |
| `strategic_objectives` | R11 | Free-text (long) |
| `planning_year` | R12 | Always 2026 |
| `date_prepared` | R13 | Date string, varies per workbook |

---

## Block B — Action Plan Matrix (PMU/ICT: R16-R33, QM: R15-R66)

### Header Row
```
PMU/ICT R16: Result Level | Target Result (SMART) | Key Actions/Activities | Key Risk | Mitigation/Control Measures | Key Performance Output/Outcome Indicators | Target | Responsible Office/Person | Timeline | Fund Source | Budget Requirements | Budget Allocation (Based on 2026 Budget)
```

QM R16: identical header, but the header row is R16 (not R15) because QM has no blank row before B.

### Data Rows

**PMU**: 18 data rows (R17-R33, but R17 has `[object Object]` rich text, R18-R33 = 16 real rows)
**ICT**: 16 data rows (R17-R33, R17 rich text, R18-R33 real)
**QM**: 50 data rows (R17-R66, with R17 rich text)

### Column Mapping

| Col | Header | DB Field | Type |
|---|---|---|---|
| A (1) | Result Level | `result_level` | Text (e.g. "OUTCOME 1", "OUTPUT 1.1") |
| B (2) | Target Result (SMART) | `target_result` | Text |
| C (3) | Key Actions/Activities | `key_actions` | Text (bullet points with `•`) |
| D (4) | Key Risk | `key_risk` | Text |
| E (5) | Mitigation/Control Measures | `mitigation` | Text |  
| F (6) | Key Performance Output/Outcome Indicators | `performance_indicator` | Text |
| G (7) | Target | `target` | Text (e.g. "1 program with COPC") |
| H (8) | Responsible Office/Person | `responsible_office` | Text |
| I (9) | Timeline | `timeline` | Text (e.g. "2026", "Q1 2026") |
| J (10) | Fund Source | `fund_source` | Text (e.g. "GAA / College Fund") |
| K (11) | Budget Requirements | `budget_requirements` | Numeric or text |
| L (12) | Budget Allocation | `budget_allocation` | Numeric or text |

**Rich text issue**: R17 in all workbooks has `[object Object]` — these are rich text objects from merged cells. They should be skipped or extracted as plain text.

### Row grouping by Result Level
- **OUTCOME N**: Multiple rows may share the same outcome label (e.g. "OUTCOME 1")
- **OUTPUT N.M**: Nested under outcomes
- Same `target_result` repeats for all rows under an outcome

---

## Block C — Monitoring (PMU/ICT: R34-R42, QM: R67-R82)

```
R34/R67: C. MONITORING
R36/R68: ITEM | ITEM | DETAILS (merged)
         [QM has R68 header — PMU/ICT at R36]
R37/R69: Monitoring Frequency | Monitoring Frequency | Quarterly
         [QM R70: Means of Verification | Means of Verification | <rich text>]
         [QM R71-R78: Means of Verification rows — varies in QM]
R38/R79: Reporting Office | Reporting Office | <office name>
         [PMU: R38 is blank after Reporting Office label]
```

### QM Difference
QM has **Means of Verification** (R70-R78) that PMU and ICT do not. This is a multiline rich text field listing ISO standards and output references. Only the first few text lines are visible in plain text extraction.

### Fields extractable from Block C
| DB Field | Row | Notes |
|---|---|---|
| `monitoring_frequency` | R37/R69 | Always "Quarterly" in all 3 |
| `means_of_verification` | R70-R78 (QM only) | Rich text, multi-line |
| `reporting_office` | R38/R79 | Text, may be empty (PMU) |

---

## Block D — Sign-off (PMU/ICT: R43-R46, QM: R83-R86)

### PMU
```
R43: Prepared by: | (blank) | (blank) | (blank) | Reviewed by: | (blank) | (blank) | (blank) | Approved by:
R44: (empty)
R45: (empty)     | (empty)  | (empty)  | (empty)  | (space)     | (empty)  | (empty)  | (empty)  | (empty)
R46: Division/Unit Head/Dean | (empty) | (empty) | (empty) | Vice President | (empty) | (empty) | (empty) | SUC III President
```
PMU has **no names filled in** — only the role title row at R46.

### ICT
```
R43: Prepared by: | (blank) | (blank) | (blank) | Reviewed by: | (blank) | (blank) | (blank) | Approved by:
R45: ARIANE M. TORRES, MIT | ... | (blank) | ... | NORBERTO P. MANGULABNAN, PhD
R46: Division/Unit Head/Dean | ... | Vice President | ... | SUC III President
```
ICT has name at Prepared by and Approved by — Reviewed by is blank.

### QM
```
R83: (blank) | Prepared by: | (blank) | (blank) | Reviewed and approved by:
R85: (blank) | YRIKA MARIE R. DUARAN, PhDTM | (blank) | (blank) | (blank) | NORBERTO P. MANGULABNAN, PhD
R86: (blank) | Division/Unit Head/Dean | (blank) | (blank) | SUC III President
```
QM merges Reviewed and Approved into a single field ("Reviewed and approved by"). Minimal role titles.

### Sign-off Column Positions
| Label | PMU/ICT Col | QM Col |
|---|---|---|
| Prepared by | B (2) | B (2) |
| Reviewed by | E (5) | E (5) — merged "Reviewed and approved by" |
| Approved by | I (9) | — (merged with Reviewed) |

---

## Differences Between Workbooks

| Feature | PMU | ICT | QM |
|---|---|---|---|
| Row count | 46 | 1000 | 1051 |
| Matrix rows | 16 (R18-33) | 16 (R18-33) | 50 (R17-66) |
| Means of Verification | No | No | Yes (R70-78) |
| Sign-off names | Empty | Partially filled | Filled |
| "Reviewed by" | Separate | Separate | Merged w/ "Approved by" |
| Blank row after B header | Yes (R15 blank) | Yes (R15 blank) | No (R15 is header) |
| C. Monitoring section | Yes (R34) | Yes (R34) | Yes (R67) |
| Rich text in R17 | Yes | Yes | Yes |

---

## Preprocessing Rules for Import

1. **Skip rows > 2 before finding section A** (R1-R2 are title, R3 blank)
2. **Read header row dynamically** (R4 for A, R15/R16 for B) — don't hardcode
3. **Detect section C by "C. MONITORING" in col A** — stop matrix parsing
4. **Skip rows where col A equals col B** (merged header rows like R5, R16, R36/R68)
5. **Handle rich text** (`[object Object]`) by converting to plain text via `result.text || result.richText?.map(t => t.text).join('')`
6. **Handle "Means of Verification" if present** — QM-only field, collect from rows after "Monitoring Frequency" until "Reporting Office"
7. **Sign-off is informational only** — not stored in DB during import; could be captured as metadata
8. **Blank `reporting_office`** (PMU case) — fall back to the office name from Block A or the current user's office
9. **All column values repeat across merged cells** — deduplicate by reading col A/B for labels, col 3 for values, or take first non-empty
10. **R17 needs special handling** — always rich text merged artifacts; skip or extract first text fragment
