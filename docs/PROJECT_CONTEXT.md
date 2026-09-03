# RBAP IDM — AI Project Context

> **Purpose:** A single, current-state briefing for an AI or developer joining the project.  
> **Product:** CHMSU Dashboard-Based Quality Management and Monitoring System  
> **Institution:** Carlos Hilado Memorial State University (CHMSU)  
> **Last reviewed:** 2026-08-10

## 1. What This Application Is

RBAP IDM is an institutional planning, monitoring, and approval platform for
CHMSU. Offices prepare annual **Results-Based Action Plans (RBAP)**, break them
into goals and objectives, attach budgets and verification evidence, track
completion, exchange remarks, and submit plans for hierarchical review.

The application is office-centric: a user's assigned office and role determine
which offices, plans, goals, and objectives that user may see or change.

The repository sometimes uses the broader names **IDM**, **RBAP/QOAP**, or
**Quality Management and Monitoring System**. The currently implemented Prisma
domain is the RBAP plan workflow. There is no separate QOAP model in the
current schema; do not invent one without a product decision.

## 2. Repository Map

```text
RBAP_IDM/
├── backend/                  # Active NestJS REST API, separate git submodule
│   ├── prisma/schema.prisma  # Database source of truth
│   └── src/                  # Controllers, services, DTOs, guards
├── shadcn/vite-monorepo/     # Active frontend, separate git submodule
│   ├── apps/web/             # React application
│   └── packages/ui/          # Shared UI components
├── docs/                     # Architecture and project reference documents
├── frontend/                 # Legacy Angular app; do not modify
└── frontend_react/           # Legacy stub; do not modify
```

`backend/` and `shadcn/vite-monorepo/` are independent git repositories. A
change inside either submodule belongs to that submodule's repository, not
necessarily the umbrella repository.

## 3. Technology Stack

### Backend

- NestJS 11 and TypeScript
- REST API with global prefix `/api/v1`
- PostgreSQL
- Prisma 7 using `@prisma/adapter-pg`
- Passport JWT and Google OAuth2
- `class-validator` and `class-transformer`
- Global `ValidationPipe({ whitelist: true, transform: true })`
- Swagger at `/api/docs`, protected by HTTP Basic Auth when enabled
- Jest unit/E2E tests and Playwright API audit tests
- ExcelJS for workbook import/export
- pdfmake for PDF plan export

### Frontend

- React 19 and Vite 8
- Turborepo workspace
- Tailwind CSS v4 and shadcn/ui
- React Router
- React Context for authentication
- Axios for HTTP requests
- `react-hook-form` and Zod for forms
- Sonner for user-facing error/success toasts

The frontend runs on `http://localhost:5173`; the backend normally runs on
`http://localhost:3000`. Vite proxies `/api` to the backend.

## 4. Domain Model

```text
Office (organizational tree)
  ├── members: User[]
  ├── head: User?
  └── plans: Plan[]
        └── goals: Goal[]
              ├── objectives: Objective[]
              └── remarks: Remark[]

User
  ├── belongs to one optional Office
  ├── may head one Office
  ├── creates Plans, Goals, Objectives
  ├── authors Remarks
  ├── receives Notifications
  └── produces ActivityLog records
```

### 4.1 Offices

`Office` is a self-referencing tree:

| Field | Meaning |
|---|---|
| `id` | CUID primary key |
| `name` | Unique office name |
| `parentId` | Optional parent office |
| `headId` | Optional unique User ID for the official office head |
| `status` | `ACTIVE` or `INACTIVE` |

`parentId` models the university hierarchy. `headId` identifies the office
head, while `members` can contain multiple users.

### 4.2 Users and Roles

`User` stores identity, authentication links, role, status, and office
membership. Sensitive fields include `googleId` and `passwordHash`; they must
never be returned in API responses.

Roles are ordered from lowest to highest oversight:

| Role | Level | Effective visibility |
|---|---:|---|
| `OFFICE_HEAD` | 0 | Own assigned office |
| `DIRECTORS` | 1 | Own office plus direct child offices |
| `VICE_PRESIDENTS` | 2 | Own office plus the full active subtree |
| `PRESIDENTS` | 3 | All active offices |
| `ADMIN` | 4 | All active offices and administration |

This is a visibility hierarchy, not a claim that every role may write every
record. Mutation checks also verify ownership, office, plan status, and the
specific operation.

### 4.3 Plans

A `Plan` is one annual RBAP submission for one office. The database enforces
`@@unique([officeId, planningYear])`, so an office can have only one plan for a
given year.

Important fields include:

- `planningYear`, `campus`, and reporting metadata
- `programProjectActivityKRA`
- `strategicAlignment`
- `breakthroughGoals`
- `strategicObjectives`
- optional `datePrepared` and `reportingOffice`
- `monitoringFrequency`, defaulting to `Quarterly`
- `status`: `DRAFT`, `SUBMITTED`, or `APPROVED`
- `submittedAt` and `approvedAt`

### 4.4 Goals

A `Goal` belongs to both a `Plan` and its office. It captures the RBAP result
and implementation details:

```text
resultLevel
targetResult
keyActions
keyRisk
mitigationMeasures
keyPerformanceIndicator
target
responsibleOfficePerson
timeline
fundSource?
budgetRequirements Decimal(15,2)
budgetAllocation Decimal(15,2)
meansOfVerification
status: NOT_STARTED | IN_PROGRESS | COMPLETED
```

`officeId` is stored directly in addition to `planId` so office-scoped
filtering is efficient and explicit.

### 4.5 Objectives

An `Objective` is an actionable child of a goal. It uses the same result,
implementation, timeline, verification, budget, and `GoalStatus` fields as a
goal. It belongs to one `Goal`, and deleting a goal cascades to its objectives.

### 4.6 Remarks

A `Remark` is currently attached to a `Goal` and authored by a `User`:

```text
id, goalId, authorId, content, createdAt
```

The current schema does not have an `objectiveId` on `Remark`, despite some
older planning documents describing objective remarks. Use the implemented goal
remark routes unless the schema is intentionally extended.

### 4.7 Notifications

Notifications belong to one recipient:

```text
id
userId
title
message
type: INFO | WARNING | SUCCESS | ERROR
read: Boolean (default false)
link?
createdAt
```

They are system-created, especially by remark and workflow services. A user
may only read or mark their own notifications.

### 4.8 Activity Logs

`ActivityLog` is the audit trail:

```text
id, userId, action, entity, entityId, details (JSON?), createdAt
```

It records who performed an operation and what entity it affected. The activity
log is primarily an administrative read surface.

## 5. Plan Lifecycle and Business Process

```text
Office Head prepares plan
  -> DRAFT
  -> adds goals
  -> adds objectives
  -> sets budgets and evidence
  -> submits
  -> SUBMITTED
  -> supervisor/president reviews
  -> APPROVED
```

Rules:

1. A plan starts as `DRAFT`.
2. Goals and objectives are created under a plan and goal respectively.
3. Draft content may be edited or deleted only when the service's ownership and
   office rules allow it.
4. `PATCH /plans/:id/submit` changes a draft to `SUBMITTED`.
5. Submitted plans appear in the pending-approval view for authorized
   supervisory roles.
6. `PATCH /plans/:id/approve` changes an eligible submitted plan to `APPROVED`.
7. Draft-only restrictions propagate to goal and objective mutations.
8. Deleting a plan cascades to goals; deleting a goal cascades to objectives
   and remarks because of Prisma `onDelete: Cascade` relations.

The exact approval policy is implemented in `PlansService`; do not infer
permissions from UI visibility alone.

## 6. Access-Control Process

Every protected request follows this conceptual sequence:

```text
HTTP request with Bearer token
  -> JwtAuthGuard
  -> JWT strategy loads and validates the user
  -> inactive users are rejected
  -> RolesGuard checks @Roles(...)
  -> controller extracts params/body/query/user
  -> service checks office scope and ownership
  -> Prisma query uses the resulting scope
  -> selected response is returned
```

Office scope is centralized in
`backend/src/offices/offices.service.ts`:

- `getAccessibleOfficeIds(user)`
- `canAccessOffice(user, officeId)`
- `getSubordinateOfficeIds(user)`
- `findAccessibleOffices(user)`
- private subtree traversal for vice-presidential scope

Other services should reuse these methods rather than implementing independent
hierarchy traversal.

## 7. Authentication Flows

### Google OAuth

```text
LoginPage
  -> GET /api/v1/auth/google
  -> Google OAuth consent
  -> GET /api/v1/auth/google/callback
  -> GoogleAuthGuard validates @chmsu.edu.ph identity
  -> existing user is loaded/linked, or registration token is issued
  -> browser redirects to /auth/callback with access_token + refresh_token
  -> AuthCallbackPage stores tokens in localStorage
  -> AuthContext calls GET /api/v1/auth/me
  -> user enters the dashboard
```

If Google identifies a new account, the callback redirects to
`/register?registration_token=...`; registration verifies that short-lived
token before creating the password-backed account.

### Password Login

```text
LoginPage
  -> POST /api/v1/auth/password-login
  -> normalize and validate @chmsu.edu.ph email
  -> load password hash
  -> bcrypt compare
  -> issue access + refresh JWTs
```

### Token Refresh

- Access token lifetime: 15 minutes
- Refresh token lifetime: 7 days
- Access and refresh tokens use different secrets.
- The frontend Axios response interceptor handles a `401`, refreshes once,
  queues concurrent failed requests, retries them, or redirects to login.
- Inactive users must not be allowed to continue making authenticated requests.

`POST /auth/dev-login` is development-only and requires a pre-existing user.
It must never be enabled in production.

## 8. Frontend-to-Backend Feature Flows

### Create and submit a plan

```text
PlansPage / PlanDetailModal
  -> plansApi.create()
  -> POST /api/v1/plans
  -> PlansController.create()
  -> PlansService.create()
  -> Prisma Plan.create()
  -> DRAFT plan returned

PlanDetailModal submit action
  -> plansApi.submit()
  -> PATCH /api/v1/plans/:id/submit
  -> PlansController.submit()
  -> PlansService.submit()
  -> status becomes SUBMITTED
```

### Add a goal and objective

```text
PlanDetailModal
  -> goalsApi.create(planId, dto)
  -> POST /api/v1/plans/:planId/goals
  -> GoalsController.create()
  -> GoalsService.create()
  -> Prisma Goal.create()

Expanded goal row
  -> objectivesApi.create(planId, goalId, dto)
  -> POST /api/v1/plans/:planId/goals/:goalId/objectives
  -> ObjectivesController.create()
  -> ObjectivesService.create()
  -> Prisma Objective.create()
```

The frontend lazily loads child goals/objectives and refreshes the parent
hierarchy after mutations.

### Remark and notification flow

```text
Goal detail remark form
  -> remarksApi.create(goalId, { content })
  -> POST /api/v1/goals/:goalId/remarks
  -> RemarksController.create()
  -> RemarksService.create()
  -> verify goal scope
  -> Prisma Remark.create()
  -> create upward Notification when applicable
  -> write ActivityLog
  -> frontend refreshes remarks and notification count
```

The notification recipient is determined by the author's role and office
hierarchy. Notifications are not directly posted by end users.

## 9. API Surface

All routes below are relative to `/api/v1`.

| Area | Main routes |
|---|---|
| Auth | `/auth/google`, `/auth/google/callback`, `/auth/me`, `/auth/password-login`, `/auth/register`, `/auth/dev-login`, `/auth/refresh`, `/auth/set-password` |
| Users | `/user` and user-management action routes in `UsersController` |
| Offices | `/offices`, `/offices/accessible`, `/offices/tree`, create/update/delete office routes |
| Plans | `/plans`, `/plans/summary`, `/plans/pending-approvals`, `/plans/:id`, submit/approve/export/import routes |
| Goals | `/plans/:planId/goals`, `/plans/:planId/goals/:id`, `/goals`, `/goals/:id` |
| Objectives | `/plans/:planId/goals/:goalId/objectives`, `/objectives`, and detail routes |
| Remarks | `/goals/:goalId/remarks`, including list/create/delete |
| Notifications | `/notifications`, `/notifications/unread-count`, read routes |
| Activity | `/activity-log` |
| Health/metrics | `/healthz` and metrics endpoints |

The controller source is authoritative for the exact HTTP verb, route spelling,
role decorator, and status code. Older README examples may use normalized REST
names such as `/users`; check the actual controller before changing clients.

### Response conventions

Most paginated plan/goal/objective/office responses use:

```json
{
  "data": [],
  "meta": {
    "total": 0,
    "take": 20,
    "skip": 0,
    "returned": 0
  }
}
```

Notifications and activity-log currently use the older shape:

```json
{ "data": [], "total": 0, "take": 20, "skip": 0 }
```

Single resources normally return the selected resource directly. Binary export
routes return PDF or XLSX responses rather than JSON.

## 10. Backend Code Organization

```text
backend/src/
├── auth/             # JWT, Google OAuth, login, registration, guards, roles
├── users/            # user lookup and admin management
├── offices/          # office CRUD and centralized hierarchy scope
├── plans/            # plan CRUD, lifecycle, dashboard, import/export
├── goals/            # nested and top-level goal access
├── objectives/       # nested and top-level objective access
├── remarks/          # goal comments and upward notifications
├── notifications/   # user inbox and read state
├── activity-log/     # audit trail
├── metrics/          # operational metrics
├── prisma/           # PrismaService and module
└── common/           # global exception filter and logging interceptor
```

Feature modules follow:

```text
<feature>.module.ts
<feature>.controller.ts
<feature>.service.ts
dto/
  create-*.dto.ts
  update-*.dto.ts
  query-*.dto.ts
```

Controllers should extract request data and delegate. Services own business
rules and Prisma calls. DTOs own validation and Swagger metadata.

## 11. Engineering Rules for Future Changes

- Treat `backend/prisma/schema.prisma` and current source code as the source of
  truth over older narrative documents.
- Use `JwtAuthGuard` for authenticated routes and `RolesGuard` plus `@Roles`
  for role-protected routes.
- Reuse `OfficesService` scope helpers; never duplicate hierarchy logic.
- Always use Prisma `select`; never return raw user rows.
- Never expose `passwordHash`, `googleId`, access tokens, or refresh tokens in
  normal API payloads or logs.
- Use DTO validation and keep `ValidationPipe` whitelist behavior intact.
- Paginate list queries and use `$transaction` for list-plus-count reads.
- Convert Prisma `P2025` update/delete failures to `NotFoundException`.
- Use Nest exceptions: `UnauthorizedException`, `ForbiddenException`,
  `NotFoundException`, and `BadRequestException` as appropriate.
- Use a Prisma transaction for dependent multi-write operations such as
  creating a record plus its audit/notification side effects when atomicity is
  required.
- Preserve the current response shape of the module being changed unless a
  coordinated frontend migration is included.
- Add or update focused Jest/E2E/Playwright coverage for behavior changes.

## 12. Important Source Files

| File | Why it matters |
|---|---|
| `backend/prisma/schema.prisma` | Exact persisted schema and relations |
| `backend/src/main.ts` | Prefix, CORS, validation, Swagger, logging |
| `backend/src/app.module.ts` | Module wiring |
| `backend/src/offices/offices.service.ts` | Central access-scope implementation |
| `backend/src/auth/auth.service.ts` | Token issuance, login, registration |
| `backend/src/auth/strategies/jwt-auth.guard.ts` | JWT strategy/guard and per-request user validation |
| `backend/src/plans/plans.service.ts` | Plan lifecycle and dashboard aggregation |
| `backend/src/remarks/remarks.service.ts` | Remarks and notification side effects |
| `shadcn/vite-monorepo/apps/web/src/lib/api.ts` | Frontend API client and DTO shapes |
| `shadcn/vite-monorepo/apps/web/src/lib/roles.ts` | Frontend role hierarchy/write helpers |
| `shadcn/vite-monorepo/apps/web/src/contexts/AuthContext.tsx` | Frontend auth state |
| `shadcn/vite-monorepo/apps/web/src/components/plan-detail-modal.tsx` | Main plan/goal/objective UI workflow |

## 13. Local Development

### Environment

Backend `.env` contains:

```env
DATABASE_URL=
PORT=3000
HOST=localhost
FRONTEND_URL=http://localhost:5173
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
SWAGGER_ENABLED=true
SWAGGER_USER=
SWAGGER_PASSWORD=
```

Never commit real credentials or tokens.

### Commands

```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npx prisma generate
npm run seed
npm run start:dev

# Backend verification
npm run build
npm run lint:check
npm run test
npm run test:e2e
npm run test:api:audit

# Active frontend
cd shadcn/vite-monorepo
npm install
npm run dev
npm run build
npm run typecheck
```

## 14. Current Caveats and Decision Boundaries

1. Some older documentation describes a simpler `Goal(title, description,
   targetDate)` model. That is obsolete; the current goal/objective schema is
   the detailed RBAP form shown above.
2. Some older documents describe objective remarks and a different
   `/api/v1/remarks` controller. The implemented route is goal-scoped under
   `/goals/:goalId/remarks`.
3. Some documents use `/users` while the current frontend client and backend
   source may use `/user` action routes. Verify controllers before modifying
   integrations.
4. The frontend's role helper treats `PRESIDENTS` and `ADMIN` as broad write
   roles, but the backend remains the final authority.
5. Refresh-token hashes are not currently persisted in the Prisma schema.
   Token revocation improvements require a deliberate schema and migration
   change.
6. Notifications are in-app database records, not a WebSocket/SSE stream.
7. The legacy Angular directories are historical and must not receive new
   feature work.

When brainstorming a new feature, first identify which existing model, office
scope rule, lifecycle transition, audit event, notification side effect, and
frontend API method it touches. Then check whether the change belongs in an
existing module or requires a new Prisma model and migration.
