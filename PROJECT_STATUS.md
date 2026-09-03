# RBAP IDM — Project Status

> Last updated: 2026-07-29

## Repo Structure

```
RBAP_IDM/
├── backend/                  # NestJS v11 + Prisma v7 + PostgreSQL (main API)
├── shadcn/vite-monorepo/     # Turborepo — active frontend dev target
│   ├── apps/web/             # React 19 + Vite + Tailwind v4 + shadcn/ui (port 5173)
│   └── packages/ui/          # Shared shadcn/ui component library (@workspace/ui)
├── docs/                     # Architecture, onboarding, & workflow documentation
├── frontend/                 # ⚠️ LEGACY — Angular v20 + CoreUI. DO NOT WORK ON THIS.
├── frontend_react/           # ⚠️ LEGACY — old stub. DO NOT WORK ON THIS.
└── .github/workflows/        # auto-merge.yml — merges any branch push to main
```

## Build Commands

| Directory | Command | Description |
|---|---|---|
| `backend/` | `npm run start:dev` | NestJS dev server (port 3000) |
| `backend/` | `npm run build` | Compile NestJS application |
| `backend/` | `npm run lint` | ESLint + Prettier |
| `backend/` | `npm run test` | Jest unit tests |
| `backend/` | `npm run seed` | Seed DB with office hierarchy & admin user |
| `shadcn/vite-monorepo/apps/web/` | `npm run dev` | Vite dev (port 5173, proxies /api to :3000) |
| `shadcn/vite-monorepo/apps/web/` | `npm run build` | `tsc -b && vite build` — zero TS errors required |
| `shadcn/vite-monorepo/apps/web/` | `npm run lint` | Workspace lint check |

## What's Built

### Auth & Layout
- JWT auth (access 15m + refresh 7d) with Google OAuth2 (`@chmsu.edu.ph` only)
- Dev login: `POST /api/v1/auth/dev-login`
- DashboardLayout with collapsible sidebar (avatar, nav, theme cycle, sign-out)
- Session expiry detection (`isTokenExpired`), auto-redirect to login with `?expired=true`
- All pages behind auth guards
- **Header bar** with breadcrumb navigation + page title
- **Sidebar** with RBAP IDM branding, user role display, collapse toggle; filters nav items by role hierarchy
- **Alert dialog** component for confirmation prompts
- **Empty state** component for consistent placeholder UI
- **Error boundary** wraps protected routes
- **Page transitions** — fade-in + slide-up animation on page content
- **Responsive sidebar** — mobile overlay with backdrop, hamburger toggle on small screens

### Pages Built (React/shadcn monorepo)

| Page | Route | Features |
|---|---|---|
| HomePage | `/` | **Live dashboard**: plan status donut chart, plans-by-office bar chart, budget overview with progress bar, pending approvals list, KPI stat cards (users, plans, budget, pending) |
| MyPlansPage | `/my-plans` | Plans filtered to user's office only (P1) |
| PendingApprovalsPage | `/pending-approvals` | Plans from subordinate offices with SUBMITTED status (P1) |
| UsersPage | `/users` | Table + UserDetailModal (view/edit/deactivate/delete) |
| OfficesPage | `/offices` | Table + OfficeDetailModal (name/head/parent/members/delete) + Create Office dialog |
| OfficeTreePage | `/office-tree` | Visual org chart view of office hierarchy |
| PlansPage | `/plans` | Table + PlanDetailModal (create/view/edit/submit/approve/delete) |
| GoalsPage | `/goals` | Table with budget columns + progress bars + GoalDetailModal + remarks thread |
| ObjectivesPage | `/objectives` | Table + ObjectiveDetailModal (create/view/edit/delete) |
| ActivityLogPage | `/activity-log` | Activity log table (admin only) |
| NotificationsPage | `/notifications` | Full in-app notification inbox with status filtering and deep modal links |
| ProfilePage | `/profile` | User profile overview + password change form |
| LoginPage | `/login` | Google OAuth + password login + dev login |
| RegisterPage | `/register` | Email registration with Google OAuth linking |
| AuthCallbackPage | `/auth/callback` | Google OAuth callback handler |

### Plan → Goals → Objectives Hierarchy
- `PlanDetailModal` has expandable Goals section with **goal completion progress bar**
- Click a goal row to expand/collapse and see its objectives (fetched lazily)
- Each goal/objective row has a ⋮ menu (View/Edit, Delete when DRAFT)
- Add Goal / Add Objective buttons (visible when plan is DRAFT)
- Child modals open as overlays on top; after any child CRUD, both hierarchy list and parent page refresh

### Documentation Overhaul (2026-07-29 — Complete)
- **Root `README.md`**: Created comprehensive monorepo documentation covering CHMSU RBAP IDM domain, quickstart, role matrix, and env variables.
- **Backend `backend/README.md`**: Updated to cover all 9 completed NestJS modules, REST API reference table, health checks, and Prisma setup.
- **Frontend `shadcn/vite-monorepo/README.md`**: Replaced template with complete React 19 / Vite 8 / Turborepo guide, page inventory, and `@workspace/ui` documentation.
- **Architecture Guide `docs/ARCHITECTURE.md`**: Added visual execution flow maps (OAuth callback, Plan submission, Remark notifications) and domain model diagrams.

### Budget & Progress (P1 — Complete)
- **GoalsPage** — Budget requirement + allocation columns with mini progress bars showing % funded
- **PlansPage, MyPlansPage, PendingApprovalsPage** — Budget (₱) column with progress bar (% allocation vs requirement)
- **PlanDetailModal** — Goal completion progress bar (completed / total goals) with color legend (NOT_STARTED amber, IN_PROGRESS blue, COMPLETED emerald)
- **HomePage** — Budget overview card reads from `summary.overview` (no longer capped at 1000 goals via `goalsApi.browse`)
- **Backend** — `getBudgetTotalsByPlanId()` uses Prisma `groupBy` for N+1-safe budget aggregation; all plan list endpoints return per-plan `budgetRequirements`/`budgetAllocation`

### Role-Based UI (P1)
- **Sidebar filtering**: nav items hidden per role hierarchy:
  - `OFFICE_HEAD(0)` → Dashboard, My Plans
  - `DIRECTORS(1)`+ → +All Plans, Pending Approvals, Goals, Objectives
  - `PRESIDENTS(3)`+ → +Offices
  - `ADMIN(4)` → +Users
- **MyPlansPage** — `/my-plans`, lists plans filtered to user's office
- **PendingApprovalsPage** — `/pending-approvals`, lists SUBMITTED plans from subordinate offices
- **Role-gated actions inside modals**:
  - **PlanDetailModal** — Add Goal/Add Objective/Save/Submit/Delete: only for plan's owning office (OFFICE_HEAD+) or any office (PRESIDENTS/ADMIN). Approve: PRESIDENTS/ADMIN only.
  - **GoalDetailModal** — Save/Delete: only for goal's owning office (OFFICE_HEAD+) or any office (PRESIDENTS/ADMIN)
  - **ObjectiveDetailModal** — Save/Delete: only for objective's owning office (OFFICE_HEAD+) or any office (PRESIDENTS/ADMIN)
  - **UserDetailModal** — Role change, Office assignment, Activate/Deactivate, Delete: ADMIN only
  - **OfficeDetailModal** — Name/Head/Parent edits + Save/Delete: ADMIN only

## Next Steps (Priority Order)

| Priority | Phase | Status | What It Does |
|---|---|---|---|
| ✅ P0 | Gap Fixes & Security | Done | Role gating, toast error handling, setState side-effect fix, auth navigate, data leak fix (passwordHash), budget aggregation |
| ✅ P1 | Budget & Progress | Done | Budget columns across all plan tables, goal progress bars, HomePage budget from summary endpoint, N+1-safe backend aggregation |
| ✅ P1 | Role-Based UI | Done | Sidebar role filtering, My Plans page, Pending Approvals page, role-gated modal actions |
| ✅ P2 | Office Tree View | Done | Visual org chart (`/office-tree`), create office dialog |
| ✅ P2 | Reporting & Export | Done | PDF/Excel export, Excel import for plans |
| ✅ P3 | Registration | Done | Email registration with Google OAuth linking |
| ✅ P3 | Notifications | Done | In-app notifications, bell dropdown with unread-first sorting, notification links to modals |
| ✅ P3 | Activity Log | Done | Audit trail for CRUD operations (admin only) |
| ✅ P3 | Remarks/Comments | Done | Comments on goals with hierarchy-based notifications |
| ✅ P3 | Notification Inbox Page | Done | Full `/notifications` page with filters/pagination (NOT-9..NOT-12) |
| ✅ P3 | Documentation Overhaul | Done | Complete Root README, Backend README, Frontend README, and Architecture guide |
| ✅ P0 | Security Hardening | Done | Verified passwordHash stripped, root redirect guarded, dev-login tightened, CORS env-based, ngrok removed |
| ✅ P1 | Bug Fixes (Data Integrity) | Done | Verified P2025 error handling, select clauses, division-by-zero guard, activity logging |
| ✅ P2 | Code Quality | Done | Verified getApiMessage helper, standardized @Roles, isAdmin cleanup, expiresIn fix |
| ✅ P2 | AUD-17 Production Readiness | Complete | All 30+ microtasks finished (pagination, home dashboard, modal fetch caps, import dialog) |
| 🟡 P2 | Production Readiness | Planned | Final AUD-17 microtasks and production deployment |

## Key Patterns

- All Prisma queries use `select` — never raw rows
- Controllers only extract request data, call service, return result — no logic
- Services hold all business logic and Prisma calls
- NestJS built-in exceptions: `NotFoundException`, `ForbiddenException`, `BadRequestException`, `UnauthorizedException`
- List endpoints return `{ data, meta: { total, take, skip, returned } }` (offices, goals, objectives) or `{ data, total, take, skip }` (notifications, activity-log)
- `ValidationPipe` with `whitelist: true` strips unknown fields
- CORS allows both React (`:5173`) origins
- Backend prefix: `/api/v1`; Swagger: `/api/docs` (requires `SWAGGER_ENABLED=true`)
- React paths: `@` → `src/`, component imports via `@workspace/ui/components/xxx`

## Role Hierarchy

| Role | Level | Nav Access | Office Write Access |
|---|---|---|---|
| OFFICE_HEAD | 0 | Dashboard, My Plans | Own office only |
| DIRECTORS | 1 | +All Plans, Pending Approvals, Goals, Objectives | Own office only |
| VICE_PRESIDENTS | 2 | Same as DIRECTORS | Own office only |
| PRESIDENTS | 3 | +Offices | Any office |
| ADMIN | 4 | +Users | Any office |

## Key Files

| File | Purpose |
|---|---|
| `src/lib/api.ts` | All API endpoint definitions |
| `src/lib/roles.ts` | Role helpers: `ROLE_HIERARCHY`, `hasMinRole`, `canWriteOffice` |
| `src/contexts/AuthContext.tsx` | Auth state + user with `role` and `office.id` |
| `src/components/sidebar.tsx` | Role-filtered nav items |
| `src/components/dashboard-layout.tsx` | Layout with responsive sidebar |
| `src/components/plan-detail-modal.tsx` | Plan CRUD + expandable goal hierarchy |
| `src/pages/HomePage.tsx` | Dashboard with charts and KPIs |
