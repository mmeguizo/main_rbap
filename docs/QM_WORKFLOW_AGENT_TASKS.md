# QM Workflow Implementation Tasks for the Next AI Agent

## 0. Reviewed references and implementation boundary

Reviewed:

- `docs/PROJECT_CONTEXT.md`
- `docs/new requirements.md`
- `backend/prisma/schema.prisma`
- `ICT-QOAP-2026-03102026.pdf`
- `ICT-QOM-2026-Q1.pdf`
- `Final-ICT-RBAP-2026-03022026.xlsx`
- `PMU-FINAL RESULTS-BASED ACTION PLAN 2026.xlsx`
- `QM-CY-2026-BASED ACTION PLAN.xlsx`

The active frontend is `shadcn/vite-monorepo/apps/web`. Do not modify
`frontend/` or `frontend_react/`; they are legacy applications. The
`backend/` and `shadcn/vite-monorepo/` directories are separate git
submodules, so changes must be made and committed in the appropriate
submodule repository.

The RBAP database is the source of truth:

```text
Plan (RBAP annual context)
  -> Goal (RBAP result/action row)
       -> Qoap (QM-specific extension of that Goal)
            -> Qom (quarterly/annual monitoring records)
```

Do not copy RBAP fields into `Qoap`. QOAP screens should read those values
through the relation to `Goal` and `Plan`.

## 0.1 Department identity and access rules

The current user model has no separate `department` field. The authenticated
user payload exposes:

```ts
office: { id: string; name: string } | null
```

The seeded office tree identifies the two departments as:

| Department | Seeded office name | Expected experience |
| --- | --- | --- |
| PME / Planning, Monitoring and Evaluation | `Director, Planning, Monitoring and Evaluation` | Default RBAP IDM branding and RBAP navigation |
| Quality Management | `Director, Quality Management` | QM branding, QM sidebar items, and QOAP/QOM workspace |

Use the office name as the department identity for this release. The
comparison must be centralized, case-insensitive, and whitespace-tolerant.
Do not infer department from role: a `DIRECTORS` user can be PME or QM, and
an `ADMIN` is cross-department. QM branding applies only when the current
office is QM; `ADMIN` access to both domains must not automatically change the
admin's visual theme.

Backend authorization is the security boundary. PME users may use the RBAP
routes and should be rejected from QOAP/QOM mutations. QM users may use the
QOAP/QOM routes allowed by their role and office scope. `ADMIN` may manage
both according to the existing role policy. React route/sidebar hiding is
only a UX layer.

## 0.2 Current implementation audit

The next agent must inspect before creating duplicates. The current branch
already contains department-related pieces in:

- `backend/src/common/qm-office.ts`
- `backend/src/qoap/qoap.service.ts`
- `backend/src/qom/qom.service.ts`
- `backend/prisma/seed.ts`
- `shadcn/vite-monorepo/apps/web/src/lib/qm.ts`
- `shadcn/vite-monorepo/apps/web/src/components/department-layout-provider.tsx`
- `shadcn/vite-monorepo/apps/web/src/components/sidebar.tsx`
- `shadcn/vite-monorepo/apps/web/src/pages/QoapPage.tsx`

The audit must verify that these pieces agree. In particular, confirm that
the frontend does not classify PME as QM, that the API returns `user.office`,
that `/qoap` cannot be used by a PME user through manual navigation, and that
QOAP/QOM writes enforce QM-or-admin on the backend.

## 1. Proposed Prisma schema updates (first implementation output)

Add the following relations to existing models:

```prisma
// In User
createdQoaps Qoap[] @relation("UserCreatedQoaps")

// In Goal
qoap Qoap? @relation("GoalQoap")

// In Office
qoaps Qoap[] @relation("OfficeQoaps")

// In ActivityLog no schema relation is required; use entity = "Qoap"/"Qom".
```

Add these models and enum:

```prisma
enum QomMonitoringFrequency {
  MONTHLY
  QUARTERLY
  BIANNUAL
  ANNUAL
}

model Qoap {
  id                   String                @id @default(cuid())
  goalId               String                @unique
  goal                 Goal                  @relation("GoalQoap", fields: [goalId], references: [id], onDelete: Cascade)
  officeId             String
  office               Office                @relation("OfficeQoaps", fields: [officeId], references: [id])
  createdById          String
  createdBy            User                  @relation("UserCreatedQoaps", fields: [createdById], references: [id])

  // QM-specific fields only; RBAP values remain on Goal and Plan.
  functionalObjective String
  indicatorFormula    String
  resources           String
  monitoringFrequency QomMonitoringFrequency
  intendedOutcomes    String

  qoms                Qom[]
  createdAt            DateTime              @default(now())
  updatedAt            DateTime              @updatedAt

  @@index([officeId])
  @@index([createdById])
}

model Qom {
  id                    String   @id @default(cuid())
  qoapId                String
  qoap                  Qoap     @relation(fields: [qoapId], references: [id], onDelete: Cascade)
  monitoringNo          Int
  recencyDate           DateTime
  previousMonitoringDate DateTime?

  // JSON object keyed by month, for example { "jan": "-", "feb": "1" }.
  // This matches the QOM document's Jan-Dec performance columns.
  performance           Json
  overallDataResult     String?
  movDataSource         String?

  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  @@unique([qoapId, monitoringNo])
  @@index([qoapId, recencyDate])
}
```

Before applying this design, the implementing agent must confirm that each
RBAP `Goal` can have at most one QOAP row. If the product needs multiple QOAP
versions per Goal, remove `@unique` and add an explicit `planningYear` or
revision field instead. Do not silently choose versioning.

The agent must also confirm the Prisma relation syntax against the current
generated client before migration. `Goal`, `Office`, and `User` relation
arrays must be added exactly once, without duplicate relation names.

## 2. Work protocol for the free agent

- Work on one subtask at a time in the order below.
- Mark the checkbox for a subtask only after its code/documentation is
  complete and persisted.
- Do not run tests, Playwright, Jest, full builds, or lint during individual
  subtasks. This avoids free-agent timeouts.
- Keep each checkbox to one focused change. If a free-agent run is nearing
  its limit, stop after the current checkbox and continue with the next
  checkbox in a fresh run.
- Use existing repository conventions and keep changes surgical.
- After all implementation subtasks are complete, a human or a separate
  verification agent may run Prisma generation/migration, build, lint, and
  tests as one final phase.
- Do not commit secrets, generated `.env` values, or real uploaded documents.

## 3. Dependency-ordered implementation checklist

### Phase A - Database

- [x] **A1. Inspect the current schema and migration state.**
  Confirm the exact current `Plan`, `Goal`, `Office`, `User`, `ActivityLog`, and
  status models. Confirm whether the repository expects migrations in the
  backend submodule. No code changes beyond this task document.

- [x] **A2. Add the QOAP/QOM Prisma models.**
  Add the schema from section 1, including all named relations, indexes,
  cascade behavior, and the monitoring-frequency enum. Preserve every existing
  RBAP field unchanged.

- [x] **A3. Create the migration and regenerate Prisma.**
  Run the repository-approved Prisma formatting, migration, and generation
  commands only after A2. Record the migration name and generated-client
  result in the agent handoff report. Do not test application behavior here.

- [x] **A4. Decide and document the RBAP mapping.**
  Document the read mapping used by the API:

  | QOAP document column | Source |
  | --- | --- |
  | Breakthrough goals / strategic objectives | `goal.plan.breakthroughGoals` / `goal.plan.strategicObjectives` |
  | Indicators | `goal.keyPerformanceIndicator` |
  | Actions | `goal.keyActions` |
  | Targets | `goal.target` |
  | Target completion | `goal.timeline` |
  | Responsible persons | `goal.responsibleOfficePerson` |
  | Fund/budget/MOV | corresponding `Goal` fields |
  | QM-only columns | `Qoap` fields |

### Phase B - Backend foundation and access control

- [x] **B1. Wire `QoapModule` and `QomModule`.**
  Create module, controller, service, and DTO folders under
  `backend/src/qoap/` and `backend/src/qom/`. Import both modules in
  `backend/src/app.module.ts`.

- [x] **B2. Reuse existing authentication and office scope services.**
  Apply `JwtAuthGuard` and `RolesGuard` at controller class level. Use
  `@Roles` consistent with the product role policy. Inject and call
  `OfficesService.getAccessibleOfficeIds()` or
  `OfficesService.canAccessOffice()`; do not implement a second hierarchy
  traversal.

- [x] **B3. Define validated DTOs.**
  Create:

  - `CreateQoapDto`
  - `UpdateQoapDto`
  - `QueryQoapDto`
  - `CreateQomDto`
  - `UpdateQomDto`
  - `QueryQomDto`

  Use `class-validator` and Swagger decorators. Validate ISO dates, positive
  monitoring numbers, enum frequency values, required text, and the monthly
  performance object. Keep `Update` fields optional.

### Phase C - QOAP API

- [x] **C1. Implement QOAP creation.**
  Accept a `goalId` and QM-only fields. Confirm the Goal exists, obtain its
  office, enforce office scope, and reject a second QOAP for the same Goal.
  Set `createdById` from the authenticated user; never accept it from the
  client.

- [x] **C2. Implement the merged QOAP list endpoint.**
  Add `GET /qoap` with pagination and optional year/office filters. The query
  must scope through the parent Goal/Plan office and use a Prisma `include` or
  equivalent relation load to return:

  ```text
  Qoap
    -> Goal
       -> Plan
       -> Office
       -> Objectives (only if the UI needs them)
    -> Qoms (paginated or summary as designed)
  ```

  Return only safe, intentional fields. The response must not duplicate data
  into the database; flattening for the API/UI is allowed.

- [x] **C3. Implement the QOAP detail endpoint.**
  Add `GET /qoap/:id` with the same scope validation and parent RBAP include.
  A QOAP outside the user's accessible office tree must appear as not found or
  forbidden according to existing module convention.

- [x] **C4. Implement QOAP update/delete rules.**
  Permit only the roles and ownership rules approved by the project policy.
  Prevent mutation of RBAP fields through QOAP DTOs. Convert Prisma `P2025`
  to `NotFoundException`. Write an `ActivityLog` entry for each mutation.

### Phase D - QOM API

- [x] **D1. Implement QOM creation and list/detail reads.**
  Add routes for creating monitoring rows under a QOAP, listing a QOAP's
  monitoring history, and reading one QOM. Every operation must first verify
  the parent QOAP and its Goal office scope.

- [x] **D2. Enforce monitoring uniqueness and document semantics.**
  Enforce one record per `(qoapId, monitoringNo)`. Preserve the QOM PDF's
  Jan-Dec performance representation. `overallDataResult`,
  `movDataSource`, and monitoring narrative fields must remain distinct from
  the RBAP source fields.

- [x] **D3. Implement QOM updates and audit logging.**
  Restrict updates to the approved QM roles/ownership policy, validate the
  monthly performance payload, handle `P2025`, and write ActivityLog records.
  Do not add direct user-created notifications unless the product owner
  explicitly adds that requirement.

### Phase E - Frontend QM branding and navigation

- [x] **E1. Inspect the existing auth and theme providers.**
  Use `shadcn/vite-monorepo/apps/web/src/contexts/AuthContext.tsx`,
  `AuthContext.types.ts`, `main.tsx`, `components/theme-provider.tsx`, and
  `components/sidebar.tsx`. Confirm the actual `User.office` shape and avoid
  assuming an office enum that does not exist.

- [x] **E2. Add a centralized QM department predicate.**
  Create a helper such as `isQualityManagementOffice(office)` that normalizes
  the office name and handles the actual seeded QM office name. Keep this
  logic in one place so branding and navigation cannot drift.

- [x] **E3. Add `DepartmentLayoutProvider`.**
  Read the authenticated user from `AuthContext`, apply `.theme-qm` only for a
  QM office, and remove it when the user logs out or changes office. Prefer a
  stable application wrapper over uncontrolled body mutations. Keep the
  default Planning theme unchanged.

- [x] **E4. Add QM CSS variables and navigation rules.**
  Define `.theme-qm` using the existing shadcn CSS variable names. Do not
  replace the default variables globally. Add QM navigation entries only
  after route components exist; retain role guards and backend authorization.

### Phase F - Frontend QOAP/QOM surfaces

- [x] **F1. Add typed API client methods.**
  Extend `shadcn/vite-monorepo/apps/web/src/lib/api.ts` with typed QOAP and
  QOM list/detail/create/update methods. Match the existing pagination and
  Axios error handling conventions.

- [x] **F2. Build the QOAP data grid.**
  Add a QM page/component that renders one unified row from the API response:
  RBAP context columns first, then QM-specific QOAP columns. Clearly label
  read-only RBAP values and editable QM values. Do not re-create RBAP form
  fields in the QOAP persistence payload.

- [x] **F3. Build the expandable QOM monitoring view.**
  Show monitoring number, recency dates, Jan-Dec performance, overall result,
  MOV/data source, and inherited QOAP/RBAP context. Support creating and
  editing monitoring entries with `react-hook-form`, Zod, and Sonner toasts.

- [x] **F4. Add routing and department-aware empty/error states.**
  Register QM routes in the active React router. Prevent non-QM users from
  seeing QM-only navigation, while still relying on backend guards as the
  security boundary.

### Phase G - PME versus QM acceptance work

These are intentionally smaller follow-up tasks. Complete them one at a time;
do not combine them with a broad refactor.

- [x] **G1. Add a backend PME predicate.**
  Add `isPlanningMonitoringEvaluationOfficeName()` beside the existing QM
  helper. It must recognize the seeded PME name and return false for the QM
  name. Do not change role hierarchy logic.

- [x] **G2. Add a frontend PME predicate.**
  Add the matching helper to `apps/web/src/lib/qm.ts` or a nearby centralized
  department helper. Keep `isQmUser()` and `isPmeUser()` based on
  `user.office`, not on role or route.

- [x] **G3. Write the department behavior matrix.**
  Document and implement these cases:

  | Current user | RBAP navigation | QM navigation/theme | QOAP/QOM write |
  | --- | --- | --- | --- |
  | PME office member | Yes | No | No |
  | QM office member | QM-approved context only | Yes | Yes if role policy allows |
  | Admin in non-QM office | Yes | Access may be visible | Yes if backend admin policy allows |
  | User with no office | Role-approved RBAP only | No | No |

- [x] **G4. Add a department-aware `/qoap` UX guard.**
  Keep the existing role guard, then add an office predicate at the route or
  page boundary. A PME user who types `/qoap` manually must receive a
  redirect or explicit forbidden state, not the QM page.

- [x] **G5. Audit the sidebar independently.**
  Confirm PME sees the RBAP items, QM sees QOAP/QOM, and admin behavior is
  intentional. Do not remove RBAP context links from QM unless the product
  owner explicitly requires a completely separate application shell.

- [x] **G6. Audit backend QOAP/QOM authorization independently.**
  Trace one create, update, and delete path in each service. Each path must
  resolve the authenticated user's office and reject PME users before the
  Prisma mutation. Reuse `isQmOrAdmin()` and `OfficesService`; do not add
  frontend-only checks.

- [x] **G7. Confirm office changes update the experience.**
  Verify that after `GET /auth/me` returns a changed office, the provider,
  sidebar, and route behavior use the new office without requiring a stale
  localStorage flag or a full browser restart.

- [x] **G8. Produce the final handoff matrix.**
  List the exact files changed, the two office-name predicates, route
  behavior for PME/QM/admin/no-office users, and any unresolved decision
  about whether admins should see the QM theme.

## 4. Final handoff report (after all checkboxes)

The implementing agent should provide a short report containing:

- Completed checklist IDs
- Files changed in each submodule
- Prisma migration name
- Final API route table and response shapes
- Exact QM office-name predicate used
- Exact PME office-name predicate used
- PME/QM/admin/no-office behavior matrix
- Any unresolved product decision, especially QOAP versioning
- A note that tests/build/lint were intentionally deferred per this document

Only after the report is complete should a separate verification pass run the
repository's existing Prisma, backend, and frontend checks.

## 5. Phase G handoff report

Completed checklist IDs: **G1–G8** (all Phase G items). Prior phases A1–F4 were
already complete and verified.

### Files changed in this phase

Backend submodule:

- `backend/src/common/qm-office.ts` — added `PLANNING_MONITORING_EVALUATION_PATTERN`
  and `isPlanningMonitoringEvaluationOfficeName()`.

Frontend submodule:

- `apps/web/src/lib/qm.ts` — added `PLANNING_MONITORING_EVALUATION_PATTERN`,
  `isPlanningMonitoringEvaluationOffice()`, `isPmeUser()`, and
  `canManageQoapQom()`.
- `apps/web/src/pages/QoapPage.tsx` — write gating switched from `isQmUser` to
  `canManageQoapQom` so ADMIN can create/update/delete alongside QM members.
- `apps/web/src/components/qm-access-guard.tsx` — new department-aware guard for
  the `/qoap` route.
- `apps/web/src/App.tsx` — `/qoap` route now wraps `QoapPage` in
  `RoleGuard` (unchanged) plus `QmAccessGuard`.

No Prisma migration was needed; no schema changed in this phase.

### Department predicates

| Department | Predicate (backend) | Predicate (frontend) |
| --- | --- | --- |
| QM | `isQualityManagementOfficeName()` — `/quality\s*management/i` | `isQualityManagementOffice()` / `isQmUser()` |
| PME | `isPlanningMonitoringEvaluationOfficeName()` — `/planning[,\s]+monitoring\s*(?:and\s*)?evaluation/i` | `isPlanningMonitoringEvaluationOffice()` / `isPmeUser()` |
| Write access | `isQmOrAdmin(user)` | `canManageQoapQom(user)` |

The two predicates are mutually exclusive: the PME regex requires the words
`planning`, `monitoring`, and `evaluation` in order and therefore never matches
`Director, Quality Management`.

### Behavior matrix (implemented)

| Current user | RBAP navigation | QM navigation/theme | QOAP/QOM write |
| --- | --- | --- | --- |
| PME office member | Yes (role-gated RBAP items) | No (`qmOnly` filtered; no `theme-qm`) | No (`ensureCanMutate` rejects) |
| QM office member | Yes (RBAP items retained) | Yes (`theme-qm` + `/qoap` nav) | Yes if role policy allows |
| Admin in non-QM office | Yes | `/qoap` visible; theme stays default | Yes (ADMIN policy) |
| User with no office | Role-approved RBAP only | No | No |

- Sidebar (`apps/web/src/components/sidebar.tsx`): `qmOnly` items shown only to
  QM office members or ADMIN; RBAP context links are kept for QM per the
  product guidance.
- Route `/qoap` (`App.tsx`): `RoleGuard(OFFICE_HEAD)` first, then
  `QmAccessGuard` which redirects PME / no-office users to `/` with a toast.
- Backend `QoapService` and `QomService`: `ensureCanMutate()` calls
  `isQmOrAdmin()` before every create/update/delete, so PME users are rejected
  before any Prisma mutation. Read paths scope through `OfficesService`.
- Office-change behavior: `AuthContext` loads `user.office` fresh from
  `GET /auth/me` into React state; no office value is stored in localStorage, so
  a changed office immediately updates the provider, sidebar, and route guards.

### Unresolved decision

Whether ADMIN users outside the QM office should receive the `theme-qm` styling.
Current implementation applies the QM theme only to QM office members (`isQmUser`),
and ADMIN access to `/qoap` does not change the admin's visual theme — this
matches the requirement that "QM branding applies only when the current office
is QM."

### Verification note

Per the work protocol in section 2, tests/build/lint were intentionally deferred
during the individual G subtasks and should be run as a single final phase.
