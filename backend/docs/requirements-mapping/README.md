# Requirements Mapping — Template

This folder maps every field from the three real RBAP Excel workbooks to its implementation counterpart in the database, API, and frontend.

## Mapping Table Format

Each workbook gets its own markdown file with tables following this format:

| # | Source (row/label) | Requirement meaning | Prisma field | DTO field | API route(s) | Frontend component | Status | Notes |
|---|---|---|---|---|---|---|---|---|

### Column meanings

| Column | Description |
|---|---|
| **Source** | Exact workbook row number and label, e.g. `R6: "Campus"` |
| **Requirement meaning** | What the data represents in the business domain |
| **Prisma field** | Schema field name, e.g. `Plan.campus`, or `—` if not stored |
| **DTO field** | Data-transfer object field name used in create/update requests, e.g. `CreatePlanDto.campus`, or `—` |
| **API route(s)** | NestJS controller route + method, e.g. `POST /api/v1/plans (createPlan)`, or `—` |
| **Frontend component** | React component that reads/edits the field, e.g. `PlanDetailModal.tsx`, or `—` |
| **Status** | One of: `covered` (fully implemented end-to-end), `partial` (stored but missing UI or import path), `missing` (not stored at all) |
| **Notes** | Implementation nuance, migration consideration, or cross-reference to an AUD task |

### Rules

1. **Every non-empty workbook field** gets at least one row. If the same field maps cleanly to multiple workbooks, the first full mapping document covers it; later workbooks only note deltas.
2. **`covered` status requires** the field to be in the Prisma schema, exposed in a DTO/API route, and visible in the active frontend. If any leg is missing, use `partial` or `missing`.
3. **`missing` entries** must include a one-line suggested implementation in the Notes column.
4. **`partial` entries** must state what's missing (import path, UI display, or both).
5. **Row groupings matter.** `Outcome` / `Output N` are not stored as separate rows but implied by repeated `Goal.resultLevel` values. The mapping documents whether this implicit approach is sufficient or a separate grouping model is needed.

## File index

| File | Scope |
|---|---|
| `workbook-structure-notes.md` | Row ranges, column layout, section boundaries (from AUD-17-02-a) |
| `pmu-final-rbap-2026.md` | Full mapping of the PMU workbook (Baseline) |
| `final-ict-rbap-2026.md` | Deltas from PMU for the ICT workbook |
| `qm-cy-2026-action-plan.md` | Deltas from PMU for the QM workbook |
| `missing-fields-summary.md` | Consolidated backlog of all `missing`/`partial` entries across all three |
