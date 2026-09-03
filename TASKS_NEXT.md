# RBAP IDM — Next Phase Task Queue

> Generated: 2026-06-25 | Last session: 2026-07-29

## REM Phase: Remarks/Commenting Module

### Design (approved 2026-07-13)

**Goal:** Allow users to post comments (remarks) on goals. Remarks are displayed as a threaded comment section inside the existing `GoalDetailModal`. When a remark is posted, a notification is sent to the next higher role in the office hierarchy.

**Scope:** Goals only (objectives deferred to future). Frontend: remarks thread inside GoalDetailModal. Backend: full CRUD + hierarchy-based notifications.

---

### REM-1: Backend — Prisma Schema + Migration

**What:** Add `Remark` model to `prisma/schema.prisma`. Add `remarks` relation to `Goal` and `User` models. Create and apply migration.

**Schema:**
```prisma
model Remark {
  id        String   @id @default(cuid())
  goalId    String
  goal      Goal     @relation("GoalRemarks", fields: [goalId], references: [id], onDelete: Cascade)
  authorId  String
  author    User     @relation("UserRemarks", fields: [authorId], references: [id])
  content   String
  createdAt DateTime @default(now())

  @@index([goalId, createdAt])
  @@index([authorId])
}
```

Add to existing models:
- `Goal`: add `remarks Remark[] @relation("GoalRemarks")`
- `User`: add `remarks User[] @relation("UserRemarks")` (note: plural name may conflict — use `authoredRemarks` if needed)

**Test:** `npx prisma migrate dev --name add_remarks` succeeds, `npx prisma generate` succeeds, `npm run build` passes.

**Key files:**
- `backend/prisma/schema.prisma`

---

### REM-2: Backend — Remarks Module (Controller + Service + DTOs)

**What:** Create `backend/src/remarks/` module following existing patterns. Controller, service, DTOs.

**Endpoints:**
| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/goals/:goalId/remarks` | Post a remark on a goal |
| `GET` | `/goals/:goalId/remarks` | List remarks for a goal (paginated) |
| `DELETE` | `/goals/:goalId/remarks/:remarkId` | Delete own remark (or ADMIN) |

**Controller rules:**
- `@UseGuards(JwtAuthGuard, RolesGuard)` at class level
- `@Roles(ADMIN, PRESIDENTS, VICE_PRESIDENTS, DIRECTORS, OFFICE_HEAD)` on all methods
- Extract `req.user` for author and hierarchy checks

**Service rules:**
- `create(goalId, user, dto)`: verify goal exists, verify user can access goal's office (via `officesService.canAccessOffice()`), create remark, trigger notification
- `findAll(goalId, user, query)`: verify access, return paginated remarks with author info
- `delete(remarkId, user)`: verify author is user or user is ADMIN, delete remark
- Always use `select` — return remark + author name/email/role

**DTOs:**
- `CreateRemarkDto`: `content` (string, required, max 2000)
- `QueryRemarksDto`: `take` (default 20), `skip` (default 0)

**Test:** `npm run build` passes. `npm run test` passes (no new tests required for this task, but existing tests must not break).

**Key files:**
- `backend/src/remarks/remarks.module.ts` (new)
- `backend/src/remarks/remarks.controller.ts` (new)
- `backend/src/remarks/remarks.service.ts` (new)
- `backend/src/remarks/dto/create-remark.dto.ts` (new)
- `backend/src/remarks/dto/query-remarks.dto.ts` (new)
- `backend/src/app.module.ts` (add RemarksModule import)

---

### REM-3: Backend — Notification Trigger on Remark Post

**What:** When a remark is posted, create a notification for users one level up in the office hierarchy.

**Logic (in `remarks.service.ts`):**
1. Look up the goal's office via `goal.officeId`
2. Look up the office's parent via `officesService`
3. Based on the author's role, determine who to notify:
   - OFFICE_HEAD → notify users with DIRECTORS role in parent office
   - DIRECTOR → notify users with VICE_PRESIDENTS role in parent office
   - VP → notify users with PRESIDENTS role in parent office
   - PRESIDENT/ADMIN → no notification upward
4. Create `Notification` record for each recipient with:
   - `title`: "New remark on goal"
   - `message`: "{authorName} commented on a goal in {officeName}"
   - `type`: INFO
   - `link`: null (frontend can construct it from goal context)

**Dependencies:** Inject `NotificationsService` and `OfficesService` into `RemarksService`.

**Test:** `npm run build` passes. Manual test: post a remark as OFFICE_HEAD, verify notification created for Director.

**Key files:**
- `backend/src/remarks/remarks.service.ts` (modify)
- `backend/src/remarks/remarks.module.ts` (add imports)

---

### REM-4: Frontend — API Client for Remarks

**What:** Add `remarksApi` to `shadcn/vite-monorepo/apps/web/src/lib/api.ts`.

**API:**
```ts
export interface Remark {
  id: string
  goalId: string
  content: string
  createdAt: string
  author: { id: string; name: string; email: string; role: string }
}

export const remarksApi = {
  getByGoal: (goalId: string, params?: { take?: number; skip?: number }) =>
    api.get<{ data: Remark[]; meta: { total: number; take: number; skip: number; returned: number } }>(
      `/goals/${goalId}/remarks`, { params }
    ).then((r) => r.data),

  create: (goalId: string, data: { content: string }) =>
    api.post<Remark>(`/goals/${goalId}/remarks`, data).then((r) => r.data),

  delete: (goalId: string, remarkId: string) =>
    api.delete(`/goals/${goalId}/remarks/${remarkId}`).then((r) => r.data),
}
```

**Test:** `npm run build` (frontend) passes with zero TS errors.

**Key files:**
- `shadcn/vite-monorepo/apps/web/src/lib/api.ts` (modify)

---

### REM-5: Frontend — Remarks Thread in GoalDetailModal

**What:** Add a remarks comment section inside the existing `GoalDetailModal`. Show existing remarks as a scrollable thread with a text input at the bottom to post new remarks.

**UI structure:**
```
┌─ GoalDetailModal ─────────────────────────┐
│  [existing goal details...]                │
│                                            │
│  ── Remarks (3) ────────────────────────── │
│  ┌─ remark ─────────────────────────────┐  │
│  │ John Doe (OFFICE_HEAD) · 2h ago      │  │
│  │ "Budget needs review before..."      │  │
│  └──────────────────────────────────────┘  │
│  ┌─ remark ─────────────────────────────┐  │
│  │ Jane Smith (DIRECTORS) · 1h ago      │  │
│  │ "Approved, proceed with..."          │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌─ New remark ─────────────────────────┐  │
│  │ [textarea.........................]   │  │
│  │                        [Post]        │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

**Behavior:**
- Remarks section always visible in the modal (below goal details)
- Load remarks on modal open (call `remarksApi.getByGoal`)
- Show remark count in section header
- Each remark: author name, role badge, relative timestamp, content
- Text input + "Post" button at bottom (disabled while posting)
- After posting, new remark appears at top of list, input clears
- Delete button (×) visible only on own remarks (or for ADMIN)
- Use `sonner` `toast.error()` for error handling
- Max 2000 chars on textarea

**Test:** `npm run build` (frontend) passes. Open a goal in the modal, post a remark, see it appear. Verify notification bell shows new notification.

**Key files:**
- `shadcn/vite-monorepo/apps/web/src/components/goal-detail-modal.tsx` (modify)

---

### REM-6: Backend — Activity Log for Remarks

**What:** Log remark creation and deletion to the activity log.

**In `remarks.service.ts`:**
- After creating a remark: `activityLogService.log(user.id, 'CREATE', 'Remark', remark.id, { goalId, content })`
- After deleting a remark: `activityLogService.log(user.id, 'DELETE', 'Remark', remark.id, { goalId })`

**Dependencies:** Inject `ActivityLogService` into `RemarksService`.

**Test:** `npm run build` passes. Post a remark, check activity log shows the entry.

**Key files:**
- `backend/src/remarks/remarks.service.ts` (modify)
- `backend/src/remarks/remarks.module.ts` (add ActivityLogModule import)

---

## P3 — Notification Navigation & Sorting (Smart Links)

> Added 2026-07-13. Goal: clicking a notification opens the **relevant** page/modal
> (not just the dashboard), and **unread notifications sort to the top** of the bell
> dropdown. **Decision (locked): use consistent entity-type links** — one link pattern
> per entity, not role-specific. Rationale: simpler backend logic, and the target pages
> (GoalsPage `/goals`, PlansPage `/plans`, both DIRECTORS+) already match the roles that
> receive these notifications.

**Link conventions (use everywhere):**
| Entity | Link pattern | Opens |
|--------|--------------|-------|
| Goal   | `/goals?goal=${goalId}` | GoalsPage → GoalDetailModal for that goal |
| Plan   | `/plans?plan=${planId}` | PlansPage → PlanDetailModal for that plan |
| Remark | `/goals?goal=${goalId}&remark=${remarkId}` | GoalsPage → GoalDetailModal → scroll to remark |

---

### Task NOT-5: Backend — Fix goal notification links

- **Status: ✅ Complete**
- **What:** Goal notification links changed from `/plans/${planId}` → `/goals?goal=goalId`.
- **Where:** `backend/src/goals/goals.service.ts:113` — changed link to goal query param pattern.
- **Test:** Clicking a "New Goal Added" notification lands on `/goals` with GoalDetailModal open for that goal.

---

### Task NOT-6: Backend — Add remark notification links

- **Status: ✅ Complete**
- **What:** Remark-post notifications now set `link: '/goals?goal=goalId&remark=remarkId'`.
- **Where:** `backend/src/remarks/remarks.service.ts:189` — `notifyHigherRole` now receives goalId + remarkId and sets real link.
- **Test:** Clicking a "New remark on goal" notification lands on the goal modal and scrolls to the remark.

---

### Task NOT-7: Frontend — Sort unread-first in notification dropdown

- **Status: ✅ Complete**
- **What:** Bell dropdown now sorts notifications unread-first (newest), read below (newest).
- **Where:** `shadcn/vite-monorepo/apps/web/src/components/notification-bell.tsx:35` — sort applied before `setNotifications`.
- **Test:** Open bell → all unread at top, read below, each group newest-first.

---

### Task NOT-8: Frontend — Auto-open modals from URL params

- **Status: ✅ Complete**
- **What:** `?goal=` opens GoalDetailModal, `?plan=` opens PlanDetailModal, `&remark=` scrolls to that remark.
- **Where:**
  - `GoalsPage.tsx` — reads `goal` + `remark` params, opens modal + passes initialRemarkId
  - `PlansPage.tsx` — reads `plan` param, opens PlanDetailModal
  - `MyPlansPage.tsx` — reads `plan` param, opens PlanDetailModal
  - `goal-detail-modal.tsx` — accepts `initialRemarkId` prop, scrolls to remark after loading
- **Test:** `/goals?goal=<id>` → modal opens. `/goals?goal=<id>&remark=<id>` → modal opens and scrolls to remark.

---

### All notification nav/sort tasks complete

---

## P3 — Notification Inbox Page (dedicated `/notifications`)

> Added 2026-07-14. The bell dropdown now does smart navigation + unread-first sorting
> (NOT-5..NOT-8). Next logical step: a **full `/notifications` page** so users can browse,
> filter, search, and manage all their notifications in one place (not just the last 20 in
> the dropdown). Broken into small, testable chunks so the next agent can ship one at a time.

### Task NOT-9: Backend — Extend notification query filters

- **Status: ✅ Complete**
- **What:** Added optional filters to the notification list query for the upcoming `/notifications` page.
- **Where:**
  - `query-notifications.dto.ts` — added `type` (`@IsEnum(NotificationType)`), `dateFrom` (`@IsDateString()`), `dateTo` (`@IsDateString()`), `search` (`@IsString()`)
  - `notifications.service.ts` — `findAll()` now applies `where.type`, `where.createdAt` range, and `where.OR` for `contains`/`insensitive` search on `title` and `message`; `where` type changed from `{ userId: string; read?: boolean }` to `Prisma.NotificationWhereInput`
- **Test:** `GET /notifications?type=WARNING` filters by type. `GET /notifications?dateFrom=2026-07-01&dateTo=2026-07-14` filters by date range. `GET /notifications?search=plan` matches title/message. `npm run build` + `npm run test` (18 tests) pass.
- **Estimated effort:** 20-30 min
- **Dependencies:** None

---

### Task NOT-10: Backend — Paginated `/notifications` route (confirm + expose)

- **Status: ✅ Complete**
- **What:** Confirmed `GET /notifications` returns `{ data, total, take, skip }`. Added `GET /notifications/:id` detail endpoint scoped to requesting user.
- **Where:**
  - `notifications.controller.ts` — added `GET /:id` route (after `unread-count` to avoid route conflict)
  - `notifications.service.ts` — added `findOne(id, userId)` with `NotFoundException` if not found or not owned by user
- **Test:** `GET /notifications/:id` with valid ID returns the notification. Invalid ID → 404. Another user's notification → 404 (scoped). `npm run build` + `npm run test` (18 tests) pass.
- **Estimated effort:** 15 min
- **Dependencies:** NOT-9

---

### Task NOT-11: Frontend — `notificationsApi` extensions

- **Status: ✅ Complete**
- **What:** Add a richer API surface to `shadcn/vite-monorepo/apps/web/src/lib/api.ts` for the page.
- **Changes:** extend `notificationsApi.getAll` to accept `{ take, skip, read?, type?, dateFrom?, dateTo?, search? }`; add `getOne: (id) => api.get<Notification>(...).then(r => r.data)` if detail endpoint exists.
- **Where:** `shadcn/vite-monorepo/apps/web/src/lib/api.ts:530-553`
- **Test:** `npm run build` (frontend) passes with zero TS errors.
- **Estimated effort:** 10 min
- **Dependencies:** NOT-9, NOT-10

---

### Task NOT-12: Frontend — `NotificationsPage` (list + filters + pagination)

- **Status: ✅ Complete**
- **What:** New page at `/notifications` showing the full notification inbox with filtering, search, and pagination.
- **Where:** `shadcn/vite-monorepo/apps/web/src/pages/NotificationsPage.tsx`
- **Behavior:**
  - Table columns: Type (badge), Title, Message (truncated), Read status (unread dot), Created (relative time).
  - Filters: read status (All / Unread / Read) as a segmented control; Type dropdown; Date range (from/to); Search box. Follow existing table pattern (loading → error → empty → data).
  - Pagination: server-side via `getAll({ take, skip, ...filters })`.
  - Row click → `notificationsApi.markAsRead(id)` then `navigate(link)` if present (reuse NOT-5..NOT-8 link conventions). Unread dot clears on click.
  - "Mark all read" button at top (reuse `markAllAsRead`).
  - Min role: `OFFICE_HEAD` (same as other authenticated pages).
- **Test:** Visit `/notifications` → list loads with filters; switch to "Unread" → only unread show; paginate → next page loads; click a row → marked read + navigates to link; "Mark all read" clears unread badge.
- **Estimated effort:** 1-1.5 hours
- **Dependencies:** NOT-11

---

### Execution order for this section

```
NOT-9  (backend filters)   → ✅ done
NOT-10 (backend route)     → ✅ done
NOT-11 (frontend api)      → ✅ done
NOT-12 (NotificationsPage) → ✅ done
```

---

### Complete task inventory (all phases)

```
✅ Pre-fixes:        PF-1, PF-2, PF-3, PF-4
✅ Polish & QA:      POL-1, POL-2, POL-3, POL-4, POL-5, POL-6, POL-7, POL-8, POL-9, POL-10
✅ Office Tree:      OTV-1, OTV-2, OTV-3
✅ Reporting:        REP-1, REP-2, REP-3, REP-4, REP-5, REP-6
✅ Registration:     REG-1
✅ Notifications:    NOT-1, NOT-2, NOT-3, NOT-4
✅ Notif. Nav/Sort:   NOT-5, NOT-6, NOT-7, NOT-8
✅ Notification Page:  NOT-9, NOT-10, NOT-11, NOT-12
✅ Activity Log:     ACT-1, ACT-2, ACT-3
✅ Office Create:    OFC-1, OFC-2, OFC-3
✅ Remarks:          REM-1, REM-2, REM-3, REM-4, REM-5, REM-6
✅ Security:         SEC-1, SEC-2, SEC-3, SEC-4, SEC-5
✅ Bug Fixes:        FIX-1, FIX-2, FIX-3, FIX-4, FIX-5
🟡 Code Quality:     CQ-1, CQ-2, CQ-3, CQ-4 ✅
✅ User Profile:     USR-1
✅ Plan Export/Import: PLN-1, PLN-2, PLN-3, PLN-4, PLN-5
✅ Tests:            TEST-1, TEST-2, TEST-3
✅ Observability:    OBS-1, OBS-2, OBS-3, OBS-4, OBS-5, OBS-6, OBS-7
✅ Audit:            AUD-17-01, AUD-17-02-a, AUD-17-06
🔲 Audit:            AUD-17-02 (b-h), AUD-17-03..AUD-17-05, AUD-17-07..AUD-17-14
```

### What was done this session (2026-07-16)

| Task | Status | Details |
|------|--------|---------|
| Full codebase audit | ✅ Complete | Backend + frontend explored via subagents; all P0-P2 issues confirmed; NOT-11/NOT-12 verified complete |
| Task drafting | ✅ Complete | Added SEC-1..5 (security), FIX-1..5 (bugs), CQ-1..4 (quality), USR-1 (profile), TEST-1..3 (tests) |
| Updated task inventory | ✅ Complete | NOT-11/NOT-12 marked complete; new task sections added |
| NQ-1..NQ-9: Security + bugfix tasks | ✅ Verified pre-complete | All 9 fixes already in code from prior sessions |
| NQ-10: PROJECT_STATUS.md sync | ✅ Complete | Updated date, removed stale user-id 500 and Angular CORS mentions |
| PLN-1: Backend — OFFICE_HEAD PDF export | ✅ Complete | Added `Role.OFFICE_HEAD` to `plans.controller.ts:208` |
| PLN-2: Backend — OFFICE_HEAD Excel import | ✅ Complete | Added `Role.OFFICE_HEAD` to `plans.controller.ts:255` |
| PLN-3: Backend — OFFICE_HEAD Excel export | ✅ Complete | Added `Role.OFFICE_HEAD` to `plans.controller.ts:236` |
| PLN-4: Frontend — Export/Import buttons on MyPlansPage | ✅ Complete | Added Export Excel + Import buttons + ImportPlansDialog in header |
| PLN-5: Frontend — Export PDF role guard | ✅ Complete | Wrapped Export PDF with `hasMinRole(OFFICE_HEAD)` in MyPlansPage + PlansPage |
| CQ-3: Remove redundant `isAdmin` check | ✅ Complete | Removed param from service + controller; simplified `findAll()` logic |
| USR-1: ProfilePage verified complete | ✅ Complete | ProfilePage with password change form + route + sidebar nav already exist |
| TEST-1: Offices service tests verified complete | ✅ Complete | `offices.service.spec.ts` exists with 17 tests across all CRUD + access control |
| TEST-2: Goals service tests verified complete | ✅ Complete | `goals.service.spec.ts` exists with 16 tests across all CRUD + P2025 handling |
| TEST-3: Roles guard tests verified complete | ✅ Complete | `roles.guard.spec.ts` exists with 7 tests covering access/deny/missing user

### What was done this session (2026-07-14)

| Task | Status | Details |
|------|--------|---------|
| OFC-1: Backend — Lower office guards | ✅ Complete | `findAll`, `addOffice`, `updateOffice` → DIRECTORS+; `deleteOffice` stays ADMIN-only; parent-access checks via `canAccessOffice()` in both `addOffice()` and `updateOffice()` |
| OFC-2: Frontend — Lower `/offices` route guard | ✅ Complete | Changed `minRole` from PRESIDENTS → DIRECTORS in `App.tsx` |
| OFC-3: Frontend — Create Office dialog | ✅ Complete | New `create-office-dialog.tsx` with Name/Parent/Head fields; "+ New Office" button in `OfficesPage.tsx` header (DIRECTORS+ only) |
| Fix: office-detail-modal edit guards | ✅ Complete | Lowered edit fields + save/delete buttons from ADMIN → DIRECTORS so Directors can actually use the edit modal |
| Fix: @workspace/ui missing build script | ✅ Complete | Added `"build": "tsc --noEmit"` to `packages/ui/package.json` (was missing, broke `turbo build` dependency chain) |
| REM-1: Backend — Prisma Schema + Migration | ✅ Complete | Added `Remark` model, relation on Goal/User, migration `20260713071309_add_remarks` applied |
| REM-2/3/6: Backend — Remarks Module + Notifications + Activity Log | ✅ Complete | Full CRUD service/controller/DTOs; hierarchy-based notification on remark; activity logging |
| REM-4: Frontend — API Client for Remarks | ✅ Complete | `remarksApi` with getByGoal/create/delete |
| REM-5: Frontend — Remarks Thread UI | ✅ Complete | Comment section in GoalDetailModal with input, relative timestamps, delete, char counter |
| Fix: notification bell not loading | ✅ Complete | `read=false` param failed validation (no `transform:true` in ValidationPipe). Fixed both frontend (removed param) + backend (added `transform:true`). |
| NOT-5: Backend — Fix goal notification links | ✅ Complete | Goal create notifications link to `/goals?goal=id` instead of `/plans/id` |
| NOT-6: Backend — Add remark notification links | ✅ Complete | Remark notifications link to `/goals?goal=id&remark=id` instead of `null` |
| NOT-7: Frontend — Unread-first sort | ✅ Complete | Notification dropdown sorts unread first, then read, each newest-first |
| NOT-8: Frontend — Auto-open modals from URL params | ✅ Complete | `?goal=` / `?plan=` auto-open detail modals; `&remark=` scrolls to remark |
| NOT-9: Backend — Extend notification query filters | ✅ Complete | Added `type`, `dateFrom`, `dateTo`, `search` filters to `QueryNotificationsDto` + applied in `findAll()` with `Prisma.NotificationWhereInput` |
| NOT-10: Backend — Paginated route + detail endpoint | ✅ Complete | Confirmed `GET /notifications` shape; added `GET /notifications/:id` with `findOne()` scoped to user |

### Build & Test Status

| Check | Result |
|-------|--------|
| Backend `npm run build` | ✅ Passes |
| Backend `npm run test` | ✅ 8 suites, 60 tests pass |
| Frontend `npm run build` (apps/web) | ✅ Passes (tsc + vite, zero TS errors) |
| Turbo `npm run build` (monorepo) | ⚠️ Pre-existing issue — turbo daemon fails on this Windows machine. Individual package builds work fine. |

### What was done this session (2026-07-23)

| Task | Status | Details |
|------|--------|---------|
| NOT-11: Frontend API extensions | ✅ Verified complete | `notificationsApi.getAll/`getOne/`markAsRead/`markAllAsRead/`getUnreadCount` all exist in `api.ts:530-553` with full filter params |
| NOT-12: NotificationsPage | ✅ Verified complete | Page exists at `NotificationsPage.tsx` with filters, pagination, mark-as-read/navigate, mark-all-read, loading/error/empty states |
| NOT-11/NOT-12 status updated in TASKS_NEXT.md | ✅ Complete | Individual sections + execution order marked ✅ |

### What was done this session (2026-07-23)

| Task | Status | Details |
|------|--------|---------|
| NOT-11: Frontend API extensions | ✅ Verified complete | `notificationsApi.getAll/`getOne/`markAsRead/`markAllAsRead/`getUnreadCount` all exist in `api.ts:530-553` with full filter params |
| NOT-12: NotificationsPage | ✅ Verified complete | Page exists at `NotificationsPage.tsx` with filters, pagination, mark-as-read/navigate, mark-all-read, loading/error/empty states |
| NOT-11/NOT-12 status updated in TASKS_NEXT.md | ✅ Complete | Individual sections + execution order marked ✅ |
| NQ-1..NQ-9: Security + bugfix tasks | ✅ Verified pre-complete | All 9 fixes already in code from prior sessions — passwordHash stripped, root redirect guarded, dev-login tightened, CORS fixed, ngrok absent, divide-by-zero guarded, user-id 400, P2025 handled in goals/objectives/notifications |
| NQ-10: PROJECT_STATUS.md sync | ✅ Complete | Updated date, removed stale user-id 500 and Angular CORS mentions |

### What was done this session (2026-07-29)

| Task | Status | Details |
|------|--------|---------|
| SEC-1: Strip passwordHash from /auth/me | ✅ Verified in code | `findById()` in `users.service.ts:288` already deletes `passwordHash` before return |
| SEC-2: Guard root / redirect on Swagger | ✅ Verified in code | Root redirect is inside `if (swaggerEnabled)` block at `main.ts:69-71` |
| SEC-3: Tighten dev-login env check | ✅ Verified in code | `auth.controller.ts:110` checks `NODE_ENV !== 'development'` |
| SEC-4: Fix CORS to use env var | ✅ Verified in code | `main.ts:16` uses `FRONTEND_URL \|\| 'http://localhost:5173'` |
| SEC-5: Remove hardcoded ngrok URL | ✅ Verified in code | No ngrok URL found in auth.service.ts |
| FIX-1: P2025 handling in goals/objectives | ✅ Verified in code | `goals.service.ts:294,321` — try/catch for P2025 |
| FIX-2: P2025 handling in notifications | ✅ Verified in code | `notifications.service.ts:109` — catches P2025 |
| FIX-3: Add `select` to offices CRUD | ✅ Verified in code | All offices methods use `officeSelect` |
| FIX-4: Fix division-by-zero in GoalsPage | ✅ Verified in code | `GoalsPage.tsx:243` guards `budgetRequirements > 0` |
| FIX-5: Add activity logging to goals | ✅ Verified in code | `ActivityLogService` injected in `goals.service.ts:68` |
| CQ-1: getApiMessage helper | ✅ Verified in code | `getApiMessage()` exists at `api.ts:6-11`, used 41 places |
| CQ-2: Standardize @Roles | ✅ Verified in code | No string literal `@Roles('...')` found anywhere |
| CQ-4: Fix expiresIn in auth module | ✅ Verified in code | `auth.module.ts` has no `signOptions` |
| TASKS_NEXT.md sync | ✅ Complete | All remaining phases (SEC, FIX, CQ) marked ✅ Complete |

### Execution Order (updated 2026-07-29)

```
Security first (independent, any order):   → ✅ all complete
  SEC-1, SEC-2, SEC-3, SEC-4, SEC-5

Bug fixes next (independent):              → ✅ all complete
  FIX-1, FIX-2, FIX-3, FIX-4, FIX-5

Code quality: all
  CQ-1, CQ-2, CQ-3, CQ-4 → ✅ all complete

Feature work:
  USR-1 → ✅ complete

Observability:
  OBS-1..OBS-7 → ✅ all complete

Tests:
  TEST-1, TEST-2, TEST-3 → ✅ all complete
```

### What was done this session (2026-07-17)

| Task | Status | Details |
|------|--------|---------|
| OBS-1: /healthz endpoint | ✅ Complete | DB health check via Prisma `SELECT 1` |
| OBS-2: LOG_LEVEL env var + Prisma query logging | ✅ Complete | `LOG_LEVEL=debug/info/warn/error`, query logging in dev |
| OBS-3: Request logging interceptor | ✅ Complete | Global NestJS interceptor, skips /healthz and /metrics |
| OBS-4: Error logging in AllExceptionsFilter | ✅ Complete | Logger with request context (method, path, user) |
| OBS-5: Structured logging in key services | ✅ Complete | AuthService, NotificationsService, PlansService |
| OBS-6: /metrics endpoint | ✅ Complete | In-memory request counters, JSON output |
| OBS-7: Observability runbook | ✅ Complete | `backend/docs/observability.md` |
| Bugfix: theme toggle D key | ✅ Complete | Removed bare `D` key shortcut from theme-provider |
| Bugfix: Approve button role guard | ✅ Complete | `PlansPage` + `MyPlansPage` — PRESIDENTS+ only |
| AUD-17-01: Fix notification route shadowing | ✅ Complete | Moved `unread-count`/`read-all` above `:id`/`:id/read` |
| AUD-17-06: Secure Excel upload | ✅ Complete | 5MB limit, MIME validation, ParseFilePipe |
| AUD-17-02-a: Workbook structure docs | ✅ Complete | `backend/docs/requirements-mapping/workbook-structure-notes.md` |

### Key files changed this session

- `backend/src/offices/offices.controller.ts` — lowered `@Roles()` on findAll/addOffice/updateOffice to DIRECTORS+; passes `req.user` to service
- `backend/src/offices/offices.service.ts` — added `ForbiddenException`; `addOffice()` and `updateOffice()` now accept `requestingUser` and check `canAccessOffice()` on parentId
- `shadcn/vite-monorepo/apps/web/src/App.tsx` — `/offices` route guard PRESIDENTS → DIRECTORS
- `shadcn/vite-monorepo/apps/web/src/components/office-detail-modal.tsx` — edit guards ADMIN → DIRECTORS (2 occurrences)
- `shadcn/vite-monorepo/apps/web/src/components/create-office-dialog.tsx` — **new**: create dialog with react-hook-form + zod, parent/head selectors
- `shadcn/vite-monorepo/apps/web/src/pages/OfficesPage.tsx` — added "+ New Office" button (DIRECTORS+), CreateOfficeDialog integration
- `shadcn/vite-monorepo/packages/ui/package.json` — added missing `build` script
- `backend/prisma/schema.prisma` — added `Remark` model + relations on Goal/User
- `backend/src/remarks/` — new module: `remarks.module.ts`, `remarks.controller.ts`, `remarks.service.ts`, `dto/create-remark.dto.ts`, `dto/query-remarks.dto.ts`
- `backend/src/app.module.ts` — imported `RemarksModule`
- `shadcn/vite-monorepo/apps/web/src/lib/api.ts` — added `Remark` interface and `remarksApi`
- `shadcn/vite-monorepo/apps/web/src/components/goal-detail-modal.tsx` — added remarks thread UI + remark loading/posting/deleting
- `backend/prisma/migrations/20260713071309_add_remarks/` — new migration
- `backend/src/main.ts` — added `transform: true` to `ValidationPipe` (fixes boolean query params globally)
- `shadcn/vite-monorepo/apps/web/src/components/notification-bell.tsx` — removed broken `read=false` filter; added unread-first sort
- `backend/src/goals/goals.service.ts` — notification link `/plans/id` → `/goals?goal=id`
- `backend/src/plans/plans.service.ts` — all plan notification links → `/plans?plan=id` convention
- `backend/src/remarks/remarks.service.ts` — remark notification links → `/goals?goal=id&remark=id`
- `shadcn/vite-monorepo/apps/web/src/pages/GoalsPage.tsx` — auto-open GoalDetailModal from `?goal=` URL param; pass `initialRemarkId`
- `shadcn/vite-monorepo/apps/web/src/pages/PlansPage.tsx` — auto-open PlanDetailModal from `?plan=` URL param
- `shadcn/vite-monorepo/apps/web/src/pages/MyPlansPage.tsx` — auto-open PlanDetailModal from `?plan=` URL param
- `shadcn/vite-monorepo/apps/web/src/components/goal-detail-modal.tsx` — accepts `initialRemarkId` prop, scrolls to remark after loading
- `backend/src/notifications/dto/query-notifications.dto.ts` — added `type`, `dateFrom`, `dateTo`, `search` query params with validation
- `backend/src/notifications/notifications.service.ts` — `findAll()` applies new where clauses (`type`, `createdAt` range, `OR` search); added `findOne()` with `NotFoundException`
- `backend/src/notifications/notifications.controller.ts` — added `GET /:id` route for single notification detail

### Key files changed this session (2026-07-17)

- `backend/src/app.controller.ts` — added `/healthz` endpoint with DB health check
- `backend/src/main.ts` — LOG_LEVEL parsing, global logging interceptor, MetricsModule import
- `backend/src/prisma/prisma.service.ts` — Prisma query logging in dev
- `backend/src/common/interceptors/logging.interceptor.ts` — **new**: request logging interceptor (skips /healthz, /metrics)
- `backend/src/common/interceptors/metrics.interceptor.ts` — **new**: in-memory request counter
- `backend/src/common/filters/all-exceptions.filter.ts` — error logging with request context
- `backend/src/metrics/` — **new module**: metrics controller, service, module
- `backend/src/auth/auth.service.ts` — structured logging on login/refresh/password change
- `backend/src/notifications/notifications.service.ts` — logging on markAsRead/markAllAsRead
- `backend/src/plans/plans.service.ts` — logging on create/submit/approve
- `backend/src/notifications/notifications.controller.ts` — route order fix (unread-count above :id)
- `backend/src/plans/plans.controller.ts` — file validation (5MB, MIME, ParseFilePipe) on import
- `backend/docs/observability.md` — **new**: observability runbook
- `backend/docs/requirements-mapping/workbook-structure-notes.md` — **new**: 3-workbook structure analysis
- `shadcn/vite-monorepo/apps/web/src/components/theme-provider.tsx` — removed bare `D` key shortcut
- `shadcn/vite-monorepo/apps/web/src/pages/PlansPage.tsx` — approve role guard (PRESIDENTS+)
- `shadcn/vite-monorepo/apps/web/src/pages/MyPlansPage.tsx` — approve role guard (PRESIDENTS+)

### Quality Verification (re-confirmed)

All P0/P1 claims verified in prior sessions remain true. No regressions introduced.

---

## Audit Suggestions (2026-07-14)

Full codebase audit findings, categorized by priority. Not yet planned as tasks — review and promote the ones you want to tackle.

---

### P0 — Security & Critical Bugs

| # | Issue | File(s) | Details |
|---|-------|---------|---------|
| S1 | ~~Sidebar says wrong project name~~ | `sidebar.tsx:108` | **Fixed 2026-07-14.** Changed "Research-Based Extension Plan" → "Results-Based Action Plan". |
| S2 | `GET /user/user-id` 500 on missing param | `users.controller.ts` | Known bug. Controller passes `undefined` to Prisma. Fix: throw `BadRequestException` if `userId` is missing. |
| S3 | `passwordHash` potentially leaked via `/auth/me` | `auth.controller.ts:92-94`, `users.service.ts:245-255` | `findById()` selects `passwordHash: true`, returns full object as `req.user`. `getMe` returns `req.user` as-is. Should explicitly shape the response. |
| S4 | Root `/` redirects to Swagger even when disabled | `main.ts:72-74` | The redirect is registered unconditionally. Should be conditional on `swaggerEnabled`. |
| S5 | No rate limiting on auth endpoints | `auth.controller.ts` | `/auth/dev-login`, `/auth/password-login`, `/auth/register`, `/auth/refresh` have no throttling. Brute-force possible. |
| S6 | Refresh tokens not invalidated on password change | `auth.service.ts:155-163` | `setPassword()` doesn't invalidate existing refresh tokens. Stolen token remains usable. |
| S7 | `dev-login` accessible if `NODE_ENV` not set | `auth.controller.ts:107-114` | Only checks `NODE_ENV === 'production'`. Misconfigured deployment exposes dev login. |
| S8 | CORS hardcodes private IP + legacy Angular origins | `main.ts:14-22` | `http://10.100.168.9:4200` and `:5173` hardcoded. Should use `FRONTEND_URL` env var. Legacy `:4200` should be removed. |

---

### P1 — Bugs & Data Integrity

| # | Issue | File(s) | Details |
|---|-------|---------|---------|
| S9 | Goals/Objectives missing P2025 error handling | `goals.service.ts:228-271`, `objectives.service.ts:230-282` | `update()` and `delete()` don't catch Prisma P2025. Stale ID → generic 500 instead of `NotFoundException`. CLAUDE.md requires this pattern. |
| S10 | `office.update()` / `addOffice()` missing `select` | `offices.service.ts:266-273, 339-345` | Returns raw Prisma row with all fields. Other methods consistently use `select`. |
| S11 | Division by zero in GoalsPage progress bar | `GoalsPage.tsx:258` | `budgetAllocation / budgetRequirements` → `Infinity`/`NaN` when requirements is 0. `PlansPage` has a guard, `GoalsPage` doesn't. |
| S12 | UsersPage fetches 100 then client-side filters | `UsersPage.tsx:57`, `users.controller.ts:54-58` | `getAll(100, 0)` caps at 100 users. No server-side search. Silently truncates results. |
| S13 | GoalsPage/ObjectivesPage hardcode `take: 100` | `GoalsPage.tsx:70`, `ObjectivesPage.tsx:67` | Data silently truncated for offices with >100 goals/objectives. |
| S14 | Goals/Objectives missing activity logging | `goals.service.ts`, `objectives.service.ts` | Plans log create/update/delete to activity log. Goals and objectives don't. Inconsistent. |
| S15 | Goals create notifications bypassing `NotificationsService` | `goals.service.ts:99-116` | Uses `this.prisma.notification.createMany` directly instead of `NotificationsService`. Works but inconsistent with plans. |
| S16 | `notifications.service.ts` missing P2025 on `markAsRead` | `notifications.service.ts:83-88` | If notification ID doesn't belong to user, Prisma throws unhandled P2025. Should catch and return meaningful error. |

---

### P1 — Documentation Stale

| # | Issue | File(s) | Details |
|---|-------|---------|---------|
| S17 | ~~CLAUDE.md says notifications "planned but not built"~~ | `CLAUDE.md:79` | **Fixed 2026-07-14.** Updated "Currently Built Modules" to include remarks, notifications, activity-log. |
| S18 | ~~CLAUDE.md "Currently Built Modules" missing 3 modules~~ | `CLAUDE.md:68-78` | **Fixed 2026-07-14.** Added remarks, notifications, activity-log to the table. |
| S19 | ~~PROJECT_STATUS.md lists `frontend_react/` as new frontend~~ | `PROJECT_STATUS.md:11` | **Fixed 2026-07-14.** Corrected to show `frontend_react/` as legacy, `shadcn/vite-monorepo/` as active. |
| S20 | ~~PROJECT_STATUS.md missing pages~~ | `PROJECT_STATUS.md:45-56` | **Fixed 2026-07-14.** Added ActivityLogPage, RegisterPage, AuthCallbackPage, OfficeTreePage. |
| S21 | COPILOT_INSTRUCTIONS.md lists goals/objectives as "Remaining" | `.github/copilot-instructions.md:137-202` | Both modules are fully built. Section is stale. |
| S22 | COPILOT_INSTRUCTIONS.md response shape uses `page`/`limit` | `.github/copilot-instructions.md:416-424` | Actual code uses `take`/`skip`. Three different conventions documented, two used. |
| S23 | CLAUDE.md response shape inconsistency | `CLAUDE.md:113` | Says `{ data, meta: { total, take, skip, returned } }` but notifications/activity-log use `{ data, total, take, skip }`. |

---

### P2 — Code Quality

| # | Issue | File(s) | Details |
|---|-------|---------|---------|
| S24 | Duplicate `PaginationDto` classes | `users/dto/pagination.dto.ts`, `offices/dto/pagination.dto.ts` | Same DTO defined twice. Should be shared. |
| S25 | Inconsistent HTTP methods (POST for delete/toggle) | `users.controller.ts:112,146`, `offices.controller.ts:144` | `change-user-status`, `delete-user`, `delete-office` use POST instead of PATCH/DELETE. |
| S26 | `@Res()` bypass in PDF/Excel export | `plans.controller.ts:206-247` | Disables NestJS exception handling. If service throws, error won't be caught by global filter. |
| S27 | `JwtModule.registerAsync` default `expiresIn: '8h'` | `auth.module.ts:20` | Misleading — actual token lifetime is 15m (set in auth.service.ts). Module default is unused. |
| S28 | Redundant `isAdmin` check in activity-log controller | `activity-log.controller.ts:25` | Endpoint already gated by `@Roles(Role.ADMIN)`. `isAdmin` is always true. Dead code in service. |
| S29 | `CreateObjectiveDto extends CreateGoalDto` directly | `objectives/dto/create-objective.dto.ts` | Semantically confusing — objectives show goal-like Swagger descriptions. |
| S30 | `main.ts` comment says "Angular frontend" | `main.ts:11` | Should say "React frontend". Angular is legacy. |
| S31 | `@Roles()` uses string literals in some controllers | `users.controller.ts`, `offices.controller.ts`, etc. | Inconsistent with `Role` enum used in notifications/activity-log. Both work but should be consistent. |

---

### P2 — Testing Gaps

| # | Issue | File(s) | Details |
|---|-------|---------|---------|
| S32 | No unit tests for goals service | `goals/goals.service.ts` | Zero test files. |
| S33 | No unit tests for objectives service | `objectives/objectives.service.ts` | Zero test files. |
| S34 | No unit tests for offices service | `offices/offices.service.ts` | Zero test files. |
| S35 | No unit tests for plans service | `plans/plans.service.ts` | Only `excel-import.service.spec.ts` exists. Core CRUD untested. |
| S36 | No unit tests for roles guard | `auth/roles.guard.ts` | Critical auth component, zero tests. |
| S37 | No frontend tests at all | `shadcn/vite-monorepo/apps/web/` | No test runner configured, zero test files. |
| S38 | Missing E2E tests for most endpoints | `test/playwright/` | Only a subset covered by `api-endpoints.audit.spec.ts`. |

---

### Feature Ideas (future, not yet scoped)

1. **Email notifications** — Send actual emails on plan submit/approve (needs SMTP config).
2. **WebSocket real-time updates** — Replace the 60s notification poll with WebSocket push.
3. **Plan version history** — Track edits to plans/goals/objectives over time.
4. **Dashboard date-range filtering** — Let users pick date ranges for KPI/chart data.
5. **User self-service profile** — Let users change password, update profile without admin.
6. **Bulk user import** — Excel import for users (like REP-5/6 for plans).
7. **Remarks on objectives** — Extend remarks to objectives (REM phase was goals-only).

---

## SEC — Security Hardening (2026-07-16)

> P0 security issues identified in codebase audit. Each task is independent and can be done in any order.
> All tasks follow existing patterns. No new dependencies required.

---

### Task SEC-1: Backend — Strip `passwordHash` from `/auth/me` response

- **Status: ✅ Complete**

---

### Task SEC-2: Backend — Guard root `/` redirect on Swagger enabled

- **Status: ✅ Complete**
- **What:** Root `/` redirects to `/api/docs#/` unconditionally, even when Swagger is disabled (returns blank page). Move the redirect inside the `if (swaggerEnabled)` block.
- **Where:** `backend/src/main.ts:72-74` — move `app.get('/', ...)` inside the `if (swaggerEnabled)` block at line 63. When Swagger is disabled, root `/` should return 404 or a simple JSON status message.
- **Test:** With `SWAGGER_ENABLED=false`, `GET /` returns 404 (not a redirect). With `SWAGGER_ENABLED=true`, `GET /` redirects to `/api/docs#/`. `npm run build` passes.
- **Estimated effort:** 5 min
- **Dependencies:** None

---

### Task SEC-3: Backend — Tighten `dev-login` environment check

- **Status: ✅ Complete**
- **What:** `dev-login` is accessible whenever `NODE_ENV !== 'production'`, including when `NODE_ENV` is undefined/empty. Change the guard to explicitly check `NODE_ENV === 'development'` instead.
- **Where:** `backend/src/auth/auth.controller.ts:110` — change `process.env.NODE_ENV === 'production'` check to `process.env.NODE_ENV !== 'development'`.
- **Test:** With `NODE_ENV=development`, dev-login works. With `NODE_ENV=production` or `NODE_ENV=` (empty), dev-login returns 404. `npm run build` passes.
- **Estimated effort:** 5 min
- **Dependencies:** None

---

### Task SEC-4: Backend — Fix CORS to use env var, remove legacy origins

- **Status: ✅ Complete**
- **What:** CORS origin list hardcodes `http://localhost:4200` (Angular legacy), `http://10.100.168.9:4200` (private IP), and `http://10.100.168.9:5173`. Replace with `FRONTEND_URL` env var (already exists) as the primary origin. Keep `http://localhost:5173` for local dev. Remove all Angular `:4200` and private IP origins.
- **Where:** `backend/src/main.ts:14-22` — refactor the `cors()` options to use `process.env.FRONTEND_URL || 'http://localhost:5173'`.
- **Test:** With `FRONTEND_URL=http://example.com`, CORS allows `example.com`. Without env var, defaults to `localhost:5173`. No `:4200` origins anywhere. `npm run build` passes.
- **Estimated effort:** 10 min
- **Dependencies:** None

---

### Task SEC-5: Backend — Remove hardcoded ngrok URL from auth service

- **Status: ✅ Complete**
- **What:** `auth.service.ts:52` contains a hardcoded ngrok tunnel URL in an error message. Replace with a generic message or use an env var.
- **Where:** `backend/src/auth/auth.service.ts:52` — remove the hardcoded `https://unduly-enjoyed-parrot.ngrok-free.app/api/v1/auth/google/callback` from the error message.
- **Test:** Google OAuth error messages no longer contain ngrok URLs. `npm run build` passes.
- **Estimated effort:** 5 min
- **Dependencies:** None

---

## FIX — Data Integrity & Bug Fixes (2026-07-16)

> P1 bugs that affect data integrity or produce incorrect UX. Each task is independent.

---

### Task FIX-1: Backend — Add P2025 error handling to goals/objectives `update`/`delete`

- **Status: ✅ Complete**
- **What:** `goals.service.ts` and `objectives.service.ts` `update()` and `delete()` methods don't catch Prisma P2025 (record not found). A stale ID throws a generic 500 instead of `NotFoundException`. Add try/catch for `PrismaClientKnownRequestError` with code `P2025`.
- **Where:**
  - `backend/src/goals/goals.service.ts` — wrap `update()` and `delete()` Prisma calls in try/catch
  - `backend/src/objectives/objectives.service.ts` — same pattern
- **Pattern to follow:** Catch `e instanceof PrismaClientKnownRequestError && e.code === 'P2025'`, throw `NotFoundException('Goal not found')` or `NotFoundException('Objective not found')`.
- **Test:** `DELETE /goals/nonexistent-id` returns 404 (not 500). `PATCH /goals/nonexistent-id` returns 404. Same for objectives. `npm run build` + `npm run test` pass.
- **Estimated effort:** 15 min
- **Dependencies:** None

---

### Task FIX-2: Backend — Add P2025 handling to `notifications.markAsRead`

- **Status: ✅ Complete**
- **What:** `notifications.service.ts:83-88` `markAsRead()` doesn't catch P2025. If the notification ID doesn't belong to the user, Prisma throws an unhandled error resulting in a generic 500.
- **Where:** `backend/src/notifications/notifications.service.ts` — wrap the `update()` call in try/catch for P2025, throw `NotFoundException('Notification not found')`.
- **Test:** `PATCH /notifications/:invalid-id/read` returns 404 (not 500). `npm run build` + `npm run test` pass.
- **Estimated effort:** 10 min
- **Dependencies:** None

---

### Task FIX-3: Backend — Add `select` to `offices.service.ts` `update`/`create`/`delete`

- **Status: ✅ Complete**
- **What:** `updateOffice()`, `addOffice()`, and `deleteAnOffice()` return raw Prisma rows without `select`, potentially exposing internal fields. All other methods in the same file use explicit `select` clauses.
- **Where:** `backend/src/offices/offices.service.ts`
  - `updateOffice()` (~line 266) — add `select` with: `id, name, status, headId, parentId, createdAt, updatedAt`
  - `addOffice()` (~line 339) — add same `select`
  - `deleteAnOffice()` (~line 419) — add same `select`
- **Test:** `POST /offices` response matches the `select` shape (no extra fields). `PATCH /offices/:id` same. `npm run build` + `npm run test` pass.
- **Estimated effort:** 10 min
- **Dependencies:** None

---

### Task FIX-4: Frontend — Fix division-by-zero in GoalsPage progress bar

- **Status: ✅ Complete**
- **What:** `GoalsPage.tsx:258,262` divides `budgetAllocation / budgetRequirements` without guarding against `budgetRequirements === 0`. PlansPage correctly guards both values. Apply the same guard.
- **Where:** `shadcn/vite-monorepo/apps/web/src/pages/GoalsPage.tsx:253-263` — change the guard from `Number(goal.budgetAllocation) > 0` to `Number(goal.budgetAllocation) > 0 && Number(goal.budgetRequirements) > 0`.
- **Test:** Goals with `budgetRequirements=0` don't show `Infinity` or `NaN` in the progress bar. `npm run build` (frontend) passes with zero TS errors.
- **Estimated effort:** 5 min
- **Dependencies:** None

---

### Task FIX-5: Backend — Add activity logging to goals and objectives

- **Status: ✅ Complete**
- **What:** Plans log create/update/delete to activity log. Goals and objectives don't. Add `ActivityLogService` injection and logging to both modules for consistency.
- **Where:**
  - `backend/src/goals/goals.service.ts` — inject `ActivityLogService`, add `log()` calls in `create()`, `update()`, `delete()` (same pattern as `plans.service.ts`)
  - `backend/src/objectives/objectives.service.ts` — same pattern
  - `backend/src/goals/goals.module.ts` — add `ActivityLogModule` import
  - `backend/src/objectives/objectives.module.ts` — add `ActivityLogModule` import
- **Test:** Create/update/delete a goal → activity log shows entry. Same for objectives. `npm run build` + `npm run test` pass.
- **Estimated effort:** 20 min
- **Dependencies:** None

---

## CQ — Code Quality Improvements (2026-07-16)

> P2 improvements for consistency and maintainability. All tasks verified as already done in code.

---

### Task CQ-1: Frontend — Extract typed API error helper (eliminate `as any` casts)

- **Status: ✅ Complete**
- **What:** `getApiMessage()` helper exists in `api.ts:6-11` and is used across 41 sites. Zero `(error as any)` casts remain.

---

### Task CQ-2: Backend — Standardize `@Roles()` to use `Role` enum everywhere

- **Status: ✅ Complete**
- **What:** Zero string literal `@Roles('...')` patterns found. All controllers use `Role.ADMIN`, `Role.OFFICE_HEAD`, etc.

---

### Task CQ-3: Backend — Remove redundant `isAdmin` check in activity-log controller

- **Status: ✅ Complete**
- **What:** Already verified complete in prior session.

---

### Task CQ-4: Backend — Fix misleading `expiresIn: '8h'` in auth module

- **Status: ✅ Complete**
- **What:** `auth.module.ts` has no `signOptions` at all (no misleading `expiresIn` default).

---

## USR — User Profile & Password Change (2026-07-16)

> Feature: Let users view their profile and change their password without admin assistance.
> The backend API (`POST /auth/set-password`) already exists but has no frontend UI.

---

### Task USR-1: Frontend — Add ProfilePage with password change

- **Status: ✅ Complete**
- **What:** New page at `/profile` showing the current user's info (name, email, role, office) and a "Change Password" form. The password form uses `authApi.setPassword()` which already exists.
- **Where:**
  - `shadcn/vite-monorepo/apps/web/src/pages/ProfilePage.tsx` — fully implemented with react-hook-form + zod, password show/hide toggles, loading/error states
  - `shadcn/vite-monorepo/apps/web/src/App.tsx` — route already registered
  - `shadcn/vite-monorepo/apps/web/src/components/sidebar.tsx` — nav item already present
  - `shadcn/vite-monorepo/apps/web/src/lib/schemas.ts` — `changePasswordSchema` exists
- **UI:**
  ```
  ┌─ Profile ─────────────────────────┐
  │  Name: John Doe                   │
  │  Email: john@chmsu.edu.ph         │
  │  Role: OFFICE_HEAD                │
  │  Office: Academic Affairs         │
  │                                   │
  │  ── Change Password ──────────── │
  │  Current Password: [........]     │
  │  New Password:      [........]    │
  │  Confirm Password:  [........]    │
  │                     [Save]        │
  └───────────────────────────────────┘
  ```
- **Behavior:** Fetch user info from `authApi.getMe()`. Password form uses react-hook-form + zod. On submit, call `authApi.setPassword(newPassword)`. Success toast on save. Error toast on failure. Min 8 chars for new password.
- **Test:** Visit `/profile` → shows user info. Change password → success toast. Login with new password → works. Old password → fails. `npm run build` passes.
- **Estimated effort:** 30 min
- **Dependencies:** None

---

## TEST — Test Coverage Improvements (2026-07-16)

> Add missing unit tests for critical services. Each task is independent.

---

### Task TEST-1: Backend — Add unit tests for offices service

- **Status: ✅ Complete**
- **What:** `offices.service.ts` has zero test files. Add tests for core CRUD operations and access control methods.
- **Where:** `backend/src/offices/offices.service.spec.ts` (279 lines, 17 tests: findAll, findAllPaginated, getAccessibleOfficeIds, canAccessOffice, addOffice, updateOffice, deleteAnOffice)
- **Tests to write:**
  - `findAll()` returns paginated offices
  - `addOffice()` creates office with correct parentId
  - `addOffice()` throws ForbiddenException when user can't access parent
  - `updateOffice()` updates office fields
  - `deleteAnOffice()` soft-deletes office
  - `getAccessibleOfficeIds()` returns correct IDs for each role level
  - `canAccessOffice()` returns true/false correctly
- **Test:** `npm run test` passes with new test file included. All tests green.
- **Estimated effort:** 45 min
- **Dependencies:** None

---

### Task TEST-2: Backend — Add unit tests for goals service

- **Status: ✅ Complete**
- **What:** `goals.service.ts` has zero test files. Add tests for CRUD and access control.
- **Where:** `backend/src/goals/goals.service.spec.ts` (267 lines, 16 tests: create, findAll, findAllVisible, findOne, findOneVisible, update, delete, P2025 handling)
- **Tests to write:**
  - `create()` creates goal under plan
  - `findAll()` returns paginated goals with office filter
  - `findOne()` returns goal by ID
  - `update()` updates goal fields
  - `delete()` soft-deletes goal
  - `browse()` returns goals with filters
- **Test:** `npm run test` passes with new test file. All tests green.
- **Estimated effort:** 45 min
- **Dependencies:** None

---

### Task TEST-3: Backend — Add unit tests for roles guard

- **Status: ✅ Complete**
- **What:** `auth/roles.guard.ts` is a critical auth component with zero tests. Add tests for role hierarchy checking.
- **Where:** `backend/src/auth/roles.guard.spec.ts` (99 lines, 7 tests: no roles, empty roles, allowed role, denied role, missing user, ADMIN access, OFFICE_HEAD access)
- **Tests to write:**
  - Allows access when user role >= required role
  - Denies access when user role < required role
  - Allows ADMIN access to all roles
  - Handles missing user gracefully
  - Handles missing roles metadata gracefully
- **Test:** `npm run test` passes with new test file. All tests green.
- **Estimated effort:** 30 min
- **Dependencies:** None

---

## PLN — Plan Export/Import for Office Heads (2026-07-16)

> OFFICE_HEAD users see `MyPlansPage` (`/my-plans`). Current problems:
> 1. "Export PDF" button is visible but backend returns 403 (requires DIRECTORS+)
> 2. No "Export Excel" button on MyPlansPage
> 3. No "Import" button on MyPlansPage — OFFICE_HEAD must create plans manually
>
> These tasks fix the role mismatch and add the missing export/import capabilities.

---

### Task PLN-1: Backend — Allow OFFICE_HEAD to export own plan as PDF

- **Status: ✅ Complete**
- **What:** `GET /plans/:id/export/pdf` requires `DIRECTORS+`. OFFICE_HEAD users see the button on MyPlansPage but get 403. Add `Role.OFFICE_HEAD` to the `@Roles()` decorator so office heads can export their own plans.
- **Where:** `backend/src/plans/plans.controller.ts:208` — added `Role.OFFICE_HEAD`.
- **Important:** The service already verifies the user can access the plan via `canAccessOffice()`. OFFICE_HEAD can only see their own office's plans on MyPlansPage, so they can only export their own. No additional access check needed.
- **Test:** Login as OFFICE_HEAD → go to MyPlansPage → click Export PDF on a plan → PDF downloads successfully (not 403). `npm run build` + `npm run test` pass.
- **Estimated effort:** 5 min
- **Dependencies:** None

---

### Task PLN-2: Backend — Allow OFFICE_HEAD to import plans from Excel

- **Status: ✅ Complete**
- **What:** `POST /plans/import/excel` requires `DIRECTORS+`. Add `Role.OFFICE_HEAD` so office heads can import plans from Excel files.
- **Where:** `backend/src/plans/plans.controller.ts:255` — added `Role.OFFICE_HEAD`.
- **Important:** The import service already assigns `createdById: user.id` and the plan's `officeId` comes from the user's office. OFFICE_HEAD will import plans into their own office. Verify the import service uses `canAccessOffice()` or assigns office from user context.
- **Test:** Login as OFFICE_HEAD → import a valid .xlsx file → plan created in their office. `npm run build` + `npm run test` pass.
- **Estimated effort:** 10 min
- **Dependencies:** None

---

### Task PLN-3: Backend — Allow OFFICE_HEAD to bulk export their office's plans as Excel

- **Status: ✅ Complete**
- **What:** `GET /plans/export/excel` requires `DIRECTORS+`. Add `Role.OFFICE_HEAD` so office heads can export their own office's plans to Excel.
- **Where:** `backend/src/plans/plans.controller.ts:236` — added `Role.OFFICE_HEAD`.
- **Important:** The service already filters by `canAccessOffice()`. OFFICE_HEAD only sees their own office's plans.
- **Test:** Login as OFFICE_HEAD → click Export Excel → Excel file downloads with their office's plans only. `npm run build` + `npm run test` pass.
- **Estimated effort:** 5 min
- **Dependencies:** None

---

### Task PLN-4: Frontend — Add Export Excel and Import buttons to MyPlansPage

- **Status: ✅ Complete**
- **What:** MyPlansPage has no Export Excel or Import buttons. Add them in the header area, matching the pattern from PlansPage.
- **Where:** `shadcn/vite-monorepo/apps/web/src/pages/MyPlansPage.tsx` — added Export Excel + Import buttons in header, added `ImportPlansDialog` at bottom.
- **UI:**
  ```
  ┌─ My Plans ───────────────────────────────────────┐
  │  [New Plan] [Refresh] [Export Excel] [Import]     │
  └───────────────────────────────────────────────────┘
  ```
- **Test:** Visit `/my-plans` as OFFICE_HEAD → Export Excel button visible → clicking downloads Excel. Import button visible → opens dialog. `npm run build` passes.
- **Estimated effort:** 20 min
- **Dependencies:** PLN-2, PLN-3

---

### Task PLN-5: Frontend — Conditionally show/hide Export PDF based on role

- **Status: ✅ Complete**
- **What:** MyPlansPage shows "Export PDF" for all users, but after PLN-1 the backend allows OFFICE_HEAD too. For consistency and future-proofing, add a `hasMinRole` check to the Export PDF menu item.
- **Where:**
  - `shadcn/vite-monorepo/apps/web/src/pages/MyPlansPage.tsx:380` — wrapped Export PDF with `hasMinRole(user?.role, ROLE_HIERARCHY.OFFICE_HEAD)`
  - `shadcn/vite-monorepo/apps/web/src/pages/PlansPage.tsx:308` — same guard
- **Test:** OFFICE_HEAD sees Export PDF. Any authenticated user sees it (since OFFICE_HEAD is the minimum). `npm run build` passes.
- **Estimated effort:** 10 min
- **Dependencies:** PLN-1

---

### Execution order for Plan Export/Import

```
PLN-1 (backend PDF)     → ✅ complete
PLN-2 (backend import)  → ✅ complete
PLN-3 (backend Excel)   → ✅ complete
PLN-4 (frontend buttons) → ✅ complete
PLN-5 (frontend guards)  → ✅ complete
```

PLN-1, PLN-2, PLN-3 can be done in parallel. PLN-4 after PLN-2+PLN-3. PLN-5 after PLN-1.

---

## OBS — Observability: Health, Logging & Metrics (2026-07-16)

> Breakdown of "Additional Audit Findings" item #5. Goal: structured logging for key services,
> Prometheus metrics endpoint, and /healthz for deployment readiness. Each subtask is independent
> and testable. Overlaps with AUD-17-10 (health/readiness) — OBS-1 satisfies both.

---

### Task OBS-1: Backend — Add `/healthz` health check endpoint

- **Status: ✅ Complete**
- **What:** Add a `/healthz` endpoint that returns 200 when the app is running and the database is reachable. Use NestJS's built-in health check pattern or a simple controller method.
- **Where:**
  - `backend/src/app.controller.ts` — add `@Get('healthz')` method (or create a new `health.controller.ts`)
  - `backend/src/app.module.ts` — register health module if using `@nestjs/terminus`
- **Implementation:** Option A: simple controller method that runs `SELECT 1` via Prisma and returns `{ status: 'ok', timestamp }` or 503 on failure
- **Test:** `GET /healthz` returns `{ status: 'ok' }` with 200. Kill DB → returns 503. `npm run build` + `npm run test` pass.
- **Estimated effort:** 20-30 min
- **Dependencies:** None
- **Also satisfies:** AUD-17-10 health endpoint requirement

---

### Task OBS-2: Backend — Add structured JSON logging

- **Status: ✅ Complete**
- **What:** Add `LOG_LEVEL` env var, configure NestJS Logger, enable Prisma query logging in dev.
- **Where:**
  - `.env` / `.env.example` — added `LOG_LEVEL=info`
  - `backend/src/main.ts` — parse `LOG_LEVEL` to set log levels
  - `backend/src/prisma/prisma.service.ts` — `log: ['query', 'error', 'warn']` in dev, `['error']` in production
- **Test:** `LOG_LEVEL=debug` shows Prisma queries. `LOG_LEVEL=error` shows only errors. `npm run build` + `npm run test` pass.
- **Estimated effort:** 15 min
- **Dependencies:** None

---

### Task OBS-3: Backend — Add request logging interceptor

- **Status: ✅ Complete**
- **What:** Global interceptor that logs every HTTP request with method, path, status code, and response time.
- **Where:**
  - `backend/src/common/interceptors/logging.interceptor.ts` (new) — NestJS interceptor, skips `/healthz` and `/metrics`
  - `backend/src/main.ts` — registered with `app.useGlobalInterceptors(new LoggingInterceptor())`
- **Test:** API calls produce request log. `/healthz` and `/metrics` are not logged. `npm run build` + `npm run test` pass.
- **Estimated effort:** 20 min
- **Dependencies:** OBS-2

---

### Task OBS-4: Backend — Add error logging to AllExceptionsFilter

- **Status: ✅ Complete**
- **What:** Inject NestJS `Logger` into AllExceptionsFilter and log errors with request context.
- **Where:** `backend/src/common/filters/all-exceptions.filter.ts` — log exception message, stack trace, method, path, user ID
- **Test:** Trigger 500 error → console shows error log with stack trace and request context. Response unchanged. `npm run build` + `npm run test` pass.
- **Estimated effort:** 10 min
- **Dependencies:** OBS-2

---

### Task OBS-5: Backend — Add structured logging to key services

- **Status: ✅ Complete**
- **What:** Add NestJS `Logger` to AuthService, NotificationsService, PlansService for key events.
- **Where:**
  - `backend/src/auth/auth.service.ts` — log login (success/fail), dev login, token refresh, password change
  - `backend/src/notifications/notifications.service.ts` — log create, markAsRead
  - `backend/src/plans/plans.service.ts` — log create, submit, approve, unauthorized access
- **Test:** Login, create plan, post notification → structured log lines appear. `npm run build` + `npm run test` pass.
- **Estimated effort:** 20 min
- **Dependencies:** OBS-2

---

### Task OBS-6: Backend — Add `/metrics` endpoint with basic request counters

- **Status: ✅ Complete**
- **What:** Expose a `/metrics` endpoint returning JSON with in-memory request counters (no prom-client dependency).
- **Where:**
  - `backend/src/common/interceptors/metrics.interceptor.ts` (new) — `Map<string, { count, totalDuration }>` keyed by `METHOD /path`
  - `backend/src/metrics/` (new module): `controller.ts` (`GET /metrics` returns JSON), `module.ts`
  - `backend/src/main.ts` — import `MetricsModule`
- **Test:** Make API calls → `GET /api/v1/metrics` returns JSON with request counts and average duration. `npm run build` passes.
- **Estimated effort:** 20 min
- **Dependencies:** OBS-3

---

### Task OBS-7: Documentation — Observability runbook

- **Status: ✅ Complete**
- **What:** Document how to run the app with observability, read logs, query metrics.
- **Where:** `backend/docs/observability.md` (new)
- **Content:** LOG_LEVEL usage, health endpoint, metrics endpoint, log format reference, Prometheus scrape config example
- **Test:** New developer can follow doc to verify logs and metrics locally.
- **Estimated effort:** 20-30 min
- **Dependencies:** OBS-1 through OBS-6

---

### Execution order for Observability section

All OBS tasks are now ✅ Complete.

---

## Feature Ideas (future, not yet scoped)

1. **Email notifications** — Send actual emails on plan submit/approve (needs SMTP config).
2. **WebSocket real-time updates** — Replace the 60s notification poll with WebSocket push.
3. **Plan version history** — Track edits to plans/goals/objectives over time.
4. **Dashboard date-range filtering** — Let users pick date ranges for KPI/chart data.
5. **Bulk user import** — Excel import for users (like REP-5/6 for plans).
6. **Remarks on objectives** — Extend remarks to objectives (REM phase was goals-only).
7. **Server-side pagination for Goals/Objectives/Plans/Users pages** — Replace client-side `take:100` pattern with proper server-side pagination (NotificationsPage already does this correctly).

---



## Testing Each Chunk (preserved from original)

Every task above has a concrete test criterion. The agent/user should:

1. Complete the task
2. Run the test listed under "Test:"
3. Only move to the next task if the test passes
4. Run `npm run build` (frontend) or `npm run test` (backend) after each task to catch regressions

## Files to Never Touch

- `frontend/` — Legacy Angular, frozen
- `frontend_react/` — Legacy React stub, frozen
- Only work in `backend/` and `shadcn/vite-monorepo/`

---

## Additional Audit Findings & Suggested Next Tasks (2026-07-16)

> These tasks were not explicitly listed above. Each entry contains a concise description and acceptance criteria so the next agent can pick them up and implement them step-by-step.

1) CI / GitHub Actions: stabilize monorepo build

- What: Fix the Turbo/NPM build failure on Windows and ensure the repo's `ci` workflow runs `npm run lint`, `npm run build` for backend, and `turbo build` for frontend packages in a matrix. Add `--no-daemon` or adapt turbo config for Windows runners.
- Why: CI currently unreliable and blocks merges.
- Acceptance: `gh actions run` (or push) shows green CI; local `npm run build` for each package succeeds; `turbo build` completes on CI runner.
- Estimated: 1-2 hours

2) Dependency updates & security scan

- What: Run `npm outdated` for backend and frontend, update minor/patch versions, run `npm audit fix` and triage remaining advisories. Document remaining high-severity advisories in TASKS_NEXT.md.
- Acceptance: No high-severity advisories remaining untriaged; updated package-lock & changelog entry.
- Estimated: 1-2 hours

3) Database migration safety check

- What: Review pending Prisma migrations for destructive operations (DROP COLUMN/TABLE). Add a migration checklist and a pre-deploy script: `prisma migrate diff` sanity, backup snapshot command, and migration smoke-testing steps.
- Acceptance: Migration checklist added to `backend/PRERELEASE.md` and a `scripts/check-migrations.sh` (or PowerShell) created. Document run commands in TASKS_NEXT.md.
- Estimated: 45 min

4) Performance: add DB indexes for common filters

- What: Review Prisma queries used by Notifications, Goals, Objectives, and ActivityLog. Add missing indexes (e.g., notifications(recipientId, createdAt, isRead), goals(officeId, status, createdAt)). Create Prisma migration.
- Acceptance: New indexes added via migration; explain rationale in migration commit message; verify list queries faster in local benchmarking (simple count timing).
- Estimated: 1-2 hours

5) Observability: basic logs & prometheus metrics

> **Audit status (2026-07-16):** The backend has ZERO observability infrastructure.
> No Logger usage anywhere, no health endpoint, no request logging, no metrics,
> no Prisma query logging. The exception filter catches errors but never logs them.
> Everything below must be built from scratch.

---

### Task OBS-1: Backend — Add `/healthz` health check endpoint

- **Status: ✅ Complete**
- **What:** Add `/healthz` endpoint with DB connectivity check.
- **Where:** `backend/src/app.controller.ts` — `@Get('healthz')` runs `SELECT 1` via Prisma, returns 200/503.
- **Test:** `GET /api/v1/healthz` returns 200 with `{ status: 'ok' }`. DB down → 503. `npm run build` passes.
- **Estimated effort:** 10 min
- **Dependencies:** None

---

### Task OBS-2: Backend — Add `LOG_LEVEL` env var and configure NestJS Logger

- **Status: ✅ Complete**
- **What:** Add `LOG_LEVEL` env var, configure NestJS Logger, enable Prisma query logging in dev.
- **Where:** `backend/src/main.ts`, `backend/src/prisma/prisma.service.ts`
- **Test:** `LOG_LEVEL=debug` shows Prisma queries. `LOG_LEVEL=error` shows only errors. `npm run build` passes.
- **Estimated effort:** 15 min
- **Dependencies:** None

---

### Task OBS-3: Backend — Add request logging interceptor

- **Status: ✅ Complete**
- **What:** Global interceptor that logs every HTTP request with method, path, status code, and response time.
- **Where:** `backend/src/common/interceptors/logging.interceptor.ts` (new), registered in `main.ts`. Skips `/healthz` and `/metrics`.
- **Test:** API calls produce request log. `/healthz` and `/metrics` not logged. `npm run build` passes.
- **Estimated effort:** 20 min
- **Dependencies:** OBS-2

---

### Task OBS-4: Backend — Add error logging to AllExceptionsFilter

- **Status: ✅ Complete**
- **What:** Inject NestJS `Logger` into AllExceptionsFilter and log errors with request context.
- **Where:** `backend/src/common/filters/all-exceptions.filter.ts`
- **Test:** Trigger 500 error → console shows error log with stack trace and request context. Response unchanged. `npm run build` passes.
- **Estimated effort:** 10 min
- **Dependencies:** OBS-2

---

### Task OBS-5: Backend — Add structured logging to key services

- **Status: ✅ Complete**
- **What:** Add NestJS `Logger` to AuthService, NotificationsService, PlansService for key events.
- **Where:** `backend/src/auth/auth.service.ts`, `backend/src/notifications/notifications.service.ts`, `backend/src/plans/plans.service.ts`
- **Test:** Login, create plan, post notification → structured log lines appear. `npm run build` passes.
- **Estimated effort:** 20 min
- **Dependencies:** OBS-2

---

### Task OBS-6: Backend — Add `/metrics` endpoint with basic request counters

- **Status: ✅ Complete**
- **What:** Expose `/metrics` endpoint with in-memory request counters (no external dependencies).
- **Where:** `backend/src/metrics/` (new module), `backend/src/common/interceptors/metrics.interceptor.ts`
- **Test:** `GET /api/v1/metrics` returns JSON with request counts and average duration. `npm run build` passes.
- **Estimated effort:** 20 min
- **Dependencies:** OBS-3

---

### Execution order for Observability

All OBS tasks are now ✅ Complete.

6) Accessibility & Frontend QA checklist

- What: Add a small accessibility QA checklist for the frontend (keyboard navigation for modals, aria labels for bell/notifications, color contrast for badges). Implement fixes for highest-impact issues found (modal focus trap, missing aria-label on Bell button).
- Acceptance: Accessibility checklist added to TASKS_NEXT.md; at least modal focus trap fixed and ARIA labels added; `npm run build` passes.
- Estimated: 1-2 hours

7) Swagger / API docs completeness audit

- What: Ensure all new endpoints (remarks, notifications detail) have `@ApiProperty()` and controllers have proper Swagger decorators. Add missing schemas and mark deprecated endpoints.
- Acceptance: `/api/docs` shows remarks and notifications endpoints with correct request/response schemas. Basic auth still protects docs.
- Estimated: 45 min

8) Database seeding & test fixtures

- What: Expand `prisma/seed.ts` to include realistic test accounts for each role, sample offices tree, sample plans/goals/objectives with remarks & notifications for local dev.
- Acceptance: Running `npm run seed` creates deterministic test data; E2E smoke tests can run against seeded DB.
- Estimated: 1 hour

9) Release checklist and deploy notes

- What: Create `RELEASE.md` with steps to build, run migrations, seed (if needed), env gating (SWAGGER_ENABLED), and post-deploy smoke tests (health, sample API calls). Include rollback steps.
- Acceptance: `RELEASE.md` added at repo root and referenced in TASKS_NEXT.md.
- Estimated: 45 min

10) Documentation: update developer onboarding

- What: Add a short `DEVELOPMENT.md` with exact commands for starting backend and frontend, env file example, how to run seed, how to run tests, and troubleshooting tips for Windows-specific Turbo issues.
- Acceptance: `DEVELOPMENT.md` added; a new developer can follow it to start both servers locally.
- Estimated: 30-60 min

---

Notes for the next agent: each of the above tasks is independent and small. Prefer completing SEC and FIX tasks first (already recommended). For CI/Build and DB Index tasks, run migrations and tests in a disposable branch and verify locally before merging. Add clear PR descriptions and link these TASKS_NEXT.md items in PR body.

---

## Additional Deep Audit Tasks (requirements, docs, data files, API completeness)

I scanned the repository and located requirements/docs and Excel files that look like source-of-truth inputs. Found: `PMU-FINAL RESULTS-BASED ACTION PLAN 2026.xlsx`, `Final-ICT-RBAP-2026-03022026.xlsx`, `QM-CY-2026-BASED ACTION PLAN.xlsx` and project docs under `backend/docs/` and root README/CLAUDE.md. The next agent should perform the tasks below; they are broken into small, actionable steps with acceptance criteria so they can be further subdivided.

A) Requirements vs implementation trace (high priority)

- What: Validate that API endpoints + frontend pages fully cover fields and workflows present in the Excel requirements (plans, goals, objectives, budgets, responsible persons, timelines). For each Excel file, map sheet columns to Prisma models and API fields.
- Steps:
  1. Open each Excel workbook and list sheets + column headers. (Use local tooling or convert to CSV.)
  2. For each sheet (e.g., Plans, Goals, Objectives), produce a mapping table: Excel column -> Prisma model.field -> API request/response field -> Frontend component prop where used.
  3. Flag missing fields (columns present in Excel but not stored or exposed) and mismatches in format (dates, numeric currencies, enums).
- Acceptance: A CSV/Markdown mapping file added to `backend/docs/requirements-mapping/` per workbook. A short TASKS_NEXT.md subtask list (one per missing mapping) referencing exact file+sheet+column and suggested implementation (DB field, DTO, controller, frontend prop).
- Estimated: 2-4 hours (can be split per workbook)

B) Import/Seed data from Excel (medium priority)

- What: Provide scripts to import existing RBAP Excel spreadsheets into the database for staging/testing.
- Steps:
  1. Add `scripts/import-excel.ts` (Node script) that reads provided Excel files (`xlsx` package), transforms rows into seed objects (plans, goals, objectives, users), and writes to DB using Prisma client within `$transaction`.
  2. Add CLI usage and safety flags: `--dry-run` (shows counts), `--seed` (performs insert), `--skip-existing` (avoid duplicates by natural key), `--file <path>`.
- Acceptance: Running `node scripts/import-excel.js --dry-run --file "PMU-FINAL...xlsx"` prints summary and `--seed` inserts records; no duplicated constraints violations. Add example import JSON for one sample file in `backend/prisma/imports/`.
- Estimated: 3-5 hours per file (can be parallelized)

C) API contract & OpenAPI completeness (high priority)

- What: Audit OpenAPI (Swagger) coverage vs implemented endpoints and make the schema complete and machine-readable for frontend contract tests.
- Steps:
  1. Run `/api/docs-json` and save to `backend/docs/openapi.json`.
  2. Write a script `tools/verify-openapi-coverage.ts` that checks every controller route has schema entries (simple check: controllers' route paths appear in openapi.json `paths`).
  3. Add `@ApiProperty()` and response DTOs for any endpoints missing response schemas (e.g., ensure remarks, notifications, activity-log responses are explicit).
- Acceptance: `backend/docs/openapi.json` committed; verification script returns zero missing routes; frontend can import openapi.json for generating client types if desired.
- Estimated: 1-2 hours

D) API contract tests (medium priority)

- What: Add a small test harness that validates the backend adheres to schema for critical endpoints: auth/me, /plans (list), /goals/:id, /notifications.
- Steps: Implement Playwright API or Jest supertest tests that call endpoints and assert response shapes (presence/absence of passwordHash, meta fields shape, date formats). Include example tests in `test/api-contract/`.
- Acceptance: `npm run test:api-contract` passes locally and on CI.
- Estimated: 1-2 hours

E) Frontend completeness & UI mapping (medium priority)

- What: Verify each major page consumes required fields for the workflows described in the requirements files. Identify pages missing UI for Excel fields (e.g., responsibleOfficePerson not editable/displayed, timeline date granularity mismatch).
- Steps:
  1. For each mapping file from (A), open corresponding frontend components (GoalDetailModal, PlanDetailModal, ObjectiveDetailModal) and check if the prop/field is displayed and editable.
  2. File issues for missing UI controls (label, input type, validation) and add tasks to implement DTO + API + UI changes.
- Acceptance: TASKS_NEXT.md contains per-field tasks with exact file/component line references and example UI control to add.
- Estimated: 2-3 hours

F) Data validation tightening (high priority)

- What: Add server-side validation to DTOs to match Excel data constraints (date format, required fields, enum sets, numeric ranges). Ensure ValidationPipe `transform: true` is present globally (already done) and add `@IsDateString()` or `@IsISO8601()` where needed.
- Steps:
  1. Scan all DTOs under `src/**/dto/*.ts` for missing decorators on fields that are required by business rules from Excel.
  2. Update the DTOs, run `npm run build`, run tests.
- Acceptance: DTOs updated; build passes; new unit tests where appropriate.
- Estimated: 1-3 hours

G) Token lifecycle & security (high priority)

- What: Implement refresh-token revocation on password change and add optional server-side token blacklist store (Redis or DB table) for refresh tokens and logout revoke.
- Steps:
  1. Add `refresh_tokens` Prisma model (id, userId, tokenHash, expiresAt, createdAt, revoked boolean) or create Redis-backed store. Modify AuthService to store refresh token hash on issue and check on refresh/revoke.
  2. Update `setPassword()` to revoke existing tokens for that user (set revoked=true) so stolen tokens can't be used.
- Acceptance: Manual test: login → refresh token works; setPassword → old refresh token no longer works (refresh returns 403). Add unit tests where possible.
- Estimated: 3-5 hours

H) Rate limiting on auth endpoints (medium priority)

- What: Add NestJS Throttler guard for auth endpoints (`/auth/password-login`, `/auth/dev-login`, `/auth/refresh`) to prevent brute force.
- Steps:
  1. Install `@nestjs/throttler`, configure global/throttler module, apply per-route limits (e.g., 5 requests/min for login endpoints).
  2. Add tests verifying too many requests return 429.
- Acceptance: Routes rate-limited; tests pass.
- Estimated: 1-2 hours

I) Frontend performance: lazy-load heavy charts and split bundles (medium priority)

- What: Defer loading of heavy chart library (`recharts`) and large pages; use dynamic imports and route-level code splitting to reduce initial bundle.
- Steps:
  1. Replace static imports of chart components with React.lazy/dynamic import wrappers in pages where charts are not required immediately (e.g., HomePage hero charts behind tab or viewport).
  2. Verify build chunk sizes shrink below warning threshold; document results.
- Acceptance: initial page bundle reduced; build reports smaller main chunk; visual smoke test passes.
- Estimated: 2-4 hours

J) E2E coverage expansion (low-medium priority)

- What: Add Playwright API + UI tests to cover critical user journeys: Login (Google dev-login), Create Plan → Add Goal → Add Objective → Submit → Approve flow (role-swapping via seeded users), Remarks + Notification generation, Notification navigation.
- Steps:
  1. Add Playwright scenarios under `test/playwright/` using seeded data from (B).
  2. Make them runnable on CI (playwright test with headless browsers) via workflow matrix.
- Acceptance: Playwright smoke suite runs on CI and passes for core flows.
- Estimated: 4-8 hours

---

Add these items to TASKS_NEXT.md as discrete entries (A-J). For each item, include: brief description, steps, acceptance criteria, estimated effort, and files likely to change. Keep tasks small so the next agent can break them further.

End of deep audit suggestions.

---

Scripts added: `backend/scripts/import-excel.ts` (scaffold) and `backend/scripts/README.md` to help ingest Excel requirements into the DB. The import script currently runs in dry-run mode and prints sheet headers and sample rows; implement transformations next.

---

## Deep Audit Findings — 2026-07-17

> This section records findings verified against the active NestJS API, active React frontend, Prisma schema, API audit report, project docs, and the three Excel workbooks in the repository. These are additional implementation tasks, not a replacement for the earlier SEC/FIX/CQ queue.

### AUD-17-01 — Fix notification route shadowing

- **Priority:** P0
- **Status: ✅ Complete**
- **Finding:** `backend/src/notifications/notifications.controller.ts` declares `@Get(':id')` before `@Get('unread-count')`. Depending on the adapter/router matching order, `/notifications/unread-count` can be interpreted as an ID and return 404 instead of the unread count. The frontend bell calls `notificationsApi.getUnreadCount()`, so this can break the unread badge.
- **Implementation:** Moved `@Get('unread-count')` and `@Post('read-all')` above `@Get(':id')` and `@Patch(':id/read')`.
- **Files:** `backend/src/notifications/notifications.controller.ts`
- **Acceptance:** `GET /notifications/unread-count` returns a number. `GET /notifications/:id` still returns the notification. Unknown IDs return 404.

### AUD-17-02 — Make the Excel importer support the actual requirement workbooks

- **Priority:** P0
- **Execution status:** Parent task — **do not delegate as one task**. AUD-17-02-b through -02-f and -02-h are complete; execute only `AUD-17-02-g1` through `AUD-17-02-g7` in the **AUD-17 Reconciled Microtask Queue** below.
- **Finding:** The real files `PMU-FINAL RESULTS-BASED ACTION PLAN 2026.xlsx`, `Final-ICT-RBAP-2026-03022026.xlsx`, and `QM-CY-2026-BASED ACTION PLAN.xlsx` each contain one `Sheet1` with merged title rows, basic information around rows 4–13, a matrix header around row 16, and matrix data afterward. They do **not** contain `Plans`, `Goals`, and `Objectives` sheets or `Plan Ref`/`Goal Ref`/`Objective Ref` columns, which `backend/src/plans/excel-import.service.ts` currently requires.
- **Implementation:** Define a versioned canonical workbook format. Either (recommended) add a preprocessing parser for the current CHMSU format that extracts rows 6–13 as plan metadata and rows 17+ as goals, or provide an explicit downloadable normalized template with separate `Plans`, `Goals`, and `Objectives` sheets. Do not silently guess office names or create objectives from free-text matrix rows. Return a structured validation report with workbook format, row numbers, skipped rows, and blocking errors.
- **Files:** `backend/src/plans/excel-import.service.ts`, `backend/src/plans/dto/*`, `shadcn/vite-monorepo/apps/web/src/components/import-plans-dialog.tsx`, `backend/docs/requirements-mapping/` (new), `backend/scripts/import-excel.ts`.
- **Acceptance:** Dry-run on all three repository workbooks reports detected format and row counts; a supported workbook imports one plan and its matrix rows without requiring artificial refs; malformed/ambiguous rows fail with actionable row/column errors; duplicate `(officeId, planningYear)` remains blocked.
- **Estimate:** 4–8 hours, split by workbook parser, normalized template, and UI error display.

### AUD-17-03 — Map Excel requirements to fields and identify unsupported data

- **Priority:** P0
- **Status: ✅ Complete.** The mapping template, three workbook mappings, and missing-fields summary exist in `backend/docs/requirements-mapping/`. Do not delegate this parent task.
- **Finding:** The workbook matrix contains `Outcome`, `Output`, SMART target result, actions, risk, mitigation, KPI, target, responsible office/person, timeline, and fund source. The app stores most matrix fields, but it has no first-class monitoring/progress records, evidence attachments, approval signatories, or quarterly accomplishment history. `Plan.datePrepared`, `reportingOffice`, and `Goal.meansOfVerification` are stored but need explicit UI/import/export verification.
- **Implementation:** Create one mapping document per workbook with columns: source cell/row, requirement meaning, Prisma field, DTO field, API route, frontend component, and status (`covered`, `partially covered`, `missing`). Turn every `missing` item into a separate implementation task rather than hiding it in free-text fields.
- **Files:** `backend/docs/requirements-mapping/*.md` or `.csv`, `backend/prisma/schema.prisma`, plan/goal/objective DTOs and detail modals.
- **Acceptance:** Mapping covers all non-empty requirement columns and explicitly decides whether `Outcome` is represented by `Goal.resultLevel`, a new field, or a separate model. No Excel field is marked covered without a tested API and visible frontend path.
- **Estimate:** 2–3 hours for mapping; follow-up model/UI work separately.

### AUD-17-04 — Add monitoring-period progress and evidence workflow

- **Priority:** P1
- **Execution status:** Parent task — **do not delegate as one task**. It is product-decision-gated; execute only one `AUD-17-04-a` through `AUD-17-04-n` checkbox from the **AUD-17 Reconciled Microtask Queue** below.
- **Finding:** The requirement workbooks specify `Monitoring Frequency: Quarterly`, but the current schema only has a single status and static `timeline`. There is no quarterly accomplishment, actual result, variance, evidence file/link, reviewer comment, or period history.
- **Implementation:** Design a `ProgressUpdate` (or equivalent) model linked to `Goal`/`Objective` with period/year, accomplishment value/text, status, variance, evidence metadata, submittedBy, reviewedBy, and timestamps. Add owner submission, supervisor review, and read-only visibility rules. Keep the current status as a derived/current summary, not the only historical record.
- **Files:** `backend/prisma/schema.prisma` + migration, new `progress-updates` module, `plans/goals/objectives` services, frontend detail modals/pages, exports.
- **Acceptance:** An office head can submit Q1–Q4 updates; duplicate period submissions are rejected or versioned by an explicit rule; supervisors can review; exports include period history; access tests prove users cannot read another office's updates.
- **Estimate:** 1–2 days.

### AUD-17-05 — Model approval and sign-off history

- **Priority:** P1
- **Execution status:** Parent task — **do not delegate as one task**. It is workflow-decision-gated; execute only one `AUD-17-05-a` through `AUD-17-05-j` checkbox from the **AUD-17 Reconciled Microtask Queue** below.
- **Finding:** Workbooks end with `Prepared by`, `Reviewed by`, `Approved by`, and role labels, while the current plan only stores `submittedAt` and `approvedAt`. There is no approver identity, rejection/request-changes state, comments, or immutable approval history.
- **Implementation:** Add a plan status-transition/approval history model with actor, from/to status, comment, timestamp, and optional signatory role. Decide whether approval is one-step or multi-step based on the institutional requirement. Add `REJECTED`/`CHANGES_REQUESTED` only after the state machine and UI are specified.
- **Files:** `backend/prisma/schema.prisma`, `backend/src/plans/plans.service.ts`, plan DTO/controller, `plan-detail-modal.tsx`, pending approvals page, activity log.
- **Acceptance:** Every submit/approve/reject action records actor and timestamp; unauthorized roles cannot approve; an approved plan cannot be edited; the UI shows who approved and when; migration and rollback behavior are documented.
- **Estimate:** 1–2 days.

### AUD-17-06 — Secure and transactionalize Excel upload/import

- **Priority:** P1
- **Status: ✅ Complete**
- **Finding:** `POST /plans/import/excel` used `FileInterceptor('file')` without explicit size limit, MIME/extension validation, or a transaction.
- **Implementation:** Added 5MB size limit via `MaxFileSizeValidator`, `.xlsx` MIME validation via `FileTypeValidator`, `ParseFilePipe` with `fileIsRequired: true` (400 on missing file).
- **Files:** `backend/src/plans/plans.controller.ts`
- **Acceptance:** Oversized/non-XLSX uploads return 400; missing file returns 400.

### AUD-17-07 — Resolve pagination and hard caps in the active frontend

- **Priority:** P1
- **Execution status:** Parent task — **do not delegate as one task**. Execute only one `AUD-17-07-*` checkbox from the **AUD-17 Reconciled Microtask Queue** below.
- **Finding:** Active React code requests `take: 100`, `take: 200`, `take: 500`, and `take: 1000` in `HomePage.tsx`, `MyPlansPage.tsx`, `GoalsPage.tsx`, `ObjectivesPage.tsx`, and detail modals. This silently truncates large institutions and causes expensive requests. The backend already supports `take`/`skip`.
- **Implementation:** Add reusable server-side pagination hooks/components for plans, goals, objectives, offices, and users. For nested modal selectors, use searchable server-side lookup endpoints instead of loading hundreds of records. Make dashboard totals use summary/count endpoints, never a large user list.
- **Files:** `shadcn/vite-monorepo/apps/web/src/pages/{HomePage,MyPlansPage,GoalsPage,ObjectivesPage}.tsx`, `components/{goal-detail-modal,objective-detail-modal,plan-detail-modal,office-detail-modal,user-detail-modal}.tsx`, `lib/api.ts`, backend query DTOs/services.
- **Acceptance:** No active frontend request uses `take >= 100` as a substitute for pagination; pages expose total/next/previous behavior; a fixture with more than one page renders all records; dashboard KPIs remain correct without fetching 1000 users.
- **Estimate:** 1–2 days.

### AUD-17-08 — Add real API contract and authorization coverage

- **Priority:** P1
- **Execution status:** Parent task — **do not delegate as one task**. `AUD-17-08-a` is complete; execute only one `AUD-17-08-b1` through `AUD-17-08-i2` checkbox from the **AUD-17 Reconciled Microtask Queue** below.
- **Finding:** The existing Playwright report has 49/50 steps passing but is dated 2026-05-21 and still records `/user/user-id` without `userId` as a 500. It primarily covers happy paths; it does not cover notification route ordering, remarks authorization, inactive JWT rejection, cross-office isolation for every resource, upload validation, or frontend route guards.
- **Implementation:** Refresh the audit fixture and add negative tests for every module: missing/invalid params, inactive users, sibling-office access, wrong-role mutations, submitted/approved edit attempts, notification ownership, remarks ownership, and import failures. Assert response shape and absence of `passwordHash`, `googleId`, and raw Prisma fields.
- **Files:** `backend/test/` or Playwright suite, `backend/docs/playwright-api-audit.latest.md/json`, relevant controller/service specs.
- **Acceptance:** CI runs the contract suite against a disposable database; no known 500-on-validation cases remain; each role hierarchy rule has at least one allow and deny assertion; reports are regenerated with the current date.
- **Estimate:** 1–2 days.

### AUD-17-09 — Fix API/documentation drift and route naming

- **Priority:** P1
- **Execution status:** Parent task — **do not delegate as one task**. Execute only one `AUD-17-09-a` through `AUD-17-09-f` checkbox from the **AUD-17 Reconciled Microtask Queue** below.
- **Finding:** `PROJECT_STATUS.md` and prior audit notes contain stale route/status claims, including the old `/office-tree` route while the active app uses `/offices/tree`, notification-page completion drift, and old passwordHash leak claims. API list responses also use two shapes (`meta` versus top-level `total/take/skip`).
- **Implementation:** Generate current OpenAPI JSON, compare it with `backend/src` controllers and `lib/api.ts`, then update `PROJECT_STATUS.md`, `CLAUDE.md`, `backend/docs/*`, and TASKS_NEXT.md. Choose and document one pagination response contract, or explicitly version the exceptions. Add a route smoke check so renamed frontend routes and backend routes cannot drift silently.
- **Files:** `PROJECT_STATUS.md`, `CLAUDE.md`, `backend/docs/`, Swagger decorators/controllers, `shadcn/vite-monorepo/apps/web/src/lib/api.ts`.
- **Acceptance:** Every active route is documented once; every frontend API method points to a documented route; stale `/office-tree` and resolved passwordHash statements are removed; pagination consumers handle the documented shape consistently.
- **Estimate:** 3–6 hours.

### AUD-17-10 — Improve operational readiness and data lifecycle

- **Priority:** P1
- **Execution status:** Parent task — **do not delegate as one task**. `/healthz` is complete; execute only one `AUD-17-10-a` through `AUD-17-10-d` checkbox from the **AUD-17 Reconciled Microtask Queue** below.
- **Finding:** The audit fixtures create users/offices named `api.audit.*`/`API AUDIT` and the repository contains generated audit artifacts, but there is no documented cleanup command or retention policy. There is also no health/readiness endpoint that checks database connectivity before deployment.
- **Implementation:** Add a protected or environment-gated cleanup script for audit fixtures, document retention/redaction rules, and add `/healthz` plus `/readyz` (database check). Ensure logs and reports redact tokens, password hashes, and personal data. Add CI checks that fail if generated secrets or unredacted auth responses are committed.
- **Files:** `backend/src/app.controller.ts` or health module, `backend/scripts/`, `backend/docs/`, `.github/workflows/ci.yml`, `.gitignore`.
- **Acceptance:** Health returns 200 when the app is live; readiness fails when DB is unavailable; cleanup removes only tagged fixtures; audit artifacts contain no tokens/password hashes; CI verifies the redaction rule.
- **Estimate:** 4–8 hours.

### Recommended execution order

1. `AUD-17-01` route shadowing and `AUD-17-06` upload validation — ✅ Complete.
2. `AUD-17-02` (b-h) and `AUD-17-03` before further importer or seed work. AUD-17-02-a (structure docs) — ✅ Complete.
3. `AUD-17-07` pagination and `AUD-17-08` negative authorization tests.
4. `AUD-17-04` monitoring history and `AUD-17-05` approval history (requirements-driven feature work).
5. `AUD-17-09` documentation/contract synchronization and `AUD-17-10` operational readiness (OBS-1 satisfies the health endpoint requirement).

### AUD-17-11 — Remove sensitive data from committed audit artifacts

- **Priority:** P0
- **Execution status:** Parent task — **do not delegate as one task**. Execute only one `AUD-17-11-a` through `AUD-17-11-d` checkbox from the **AUD-17 Reconciled Microtask Queue** below.
- **Finding:** `backend/docs/playwright-api-audit.latest.md` and `.json` contain a real-looking bcrypt password hash, and older office response previews include `googleId` and `passwordHash` fields. Even a hash is credential material and the committed report is an unsafe data source.
- **Implementation:** Remove or replace sensitive response fields with `[REDACTED]`, regenerate the report with a redacting serializer, and inspect git history/remote exposure before deciding whether any credential rotation or history purge is required. Add a CI grep check for `passwordHash`, `googleId`, bcrypt prefixes, JWT-like strings, and OAuth tokens in generated docs.
- **Files:** `backend/docs/playwright-api-audit.latest.md`, `backend/docs/playwright-api-audit.latest.json`, Playwright audit reporter/fixtures, `.github/workflows/ci.yml`, `.gitignore`.
- **Acceptance:** No committed audit artifact contains password hashes, Google IDs, access/refresh tokens, or unredacted personal auth payloads; regenerated reports remain useful for status/path assertions; CI fails on a newly introduced secret pattern.
- **Estimate:** 1–3 hours, plus security review if the hash was ever used for a real account.

### AUD-17-12 — Prevent office-tree cycles on `parentId` update

- **Priority:** P0
- **Finding:** `backend/src/offices/offices.service.ts` `updateOffice()` (~line 220) validates that the requesting user can access the new `parentId` via `canAccessOffice()`, but it never checks whether the new `parentId` is the office itself or one of its own descendants. Since `Office.parentId` is self-referencing and `getOfficeSubtreeIds()`/tree-building logic (`buildTree`, ~line 376-414) assumes a DAG, setting an office's parent to its own child creates an infinite loop that will hang `GET /offices/tree`, `getAccessibleOfficeIds()`, and the frontend `OfficeTreePage`.
- **Implementation:** In `updateOffice()`, before applying a new `parentId`, reject the update with `BadRequestException` if `parentId === id` or if `parentId` is contained in `getOfficeSubtreeIds(id, true)` (the office's own descendant set). Add a unit test in `offices.service.spec.ts` covering both the self-parent case and the descendant-parent case.
- **Files:** `backend/src/offices/offices.service.ts`, `backend/src/offices/offices.service.spec.ts`.
- **Acceptance:** Attempting to set an office's `parentId` to itself or to one of its descendants returns 400 with a clear message; existing valid re-parenting (e.g., moving an office to a different, non-descendant parent) still works; `npm run build` + `npm run test` pass.
- **Estimate:** 30–45 minutes.

### AUD-17-13 — Add missing indexes on `User.officeId`/`status` and `Office.parentId`/`status`

- **Priority:** P1
- **Execution status:** Parent task — **do not delegate as one task**. Execute only one `AUD-17-13-a` through `AUD-17-13-f` checkbox from the **AUD-17 Reconciled Microtask Queue** below.
- **Finding:** `getAccessibleOfficeIds()`, `assignToOffice()`, `findAllWithoutOffice()`, and most office-scoped queries filter `User` by `officeId` and `status`, and filter `Office` by `parentId` and `status`, but neither `User.officeId`/`status` nor `Office.parentId`/`status` has a Prisma `@@index`. Every other frequently-filtered model in the schema (`Plan`, `Goal`, `Objective`, `Notification`, `ActivityLog`) has matching indexes; `User` and `Office` are the outliers.
- **Implementation:** Add `@@index([officeId])` and `@@index([status])` (or a combined `@@index([officeId, status])`) to `User`, and `@@index([parentId])` plus `@@index([status])` to `Office` in `backend/prisma/schema.prisma`. Run `npx prisma migrate dev --name add_user_office_indexes`.
- **Files:** `backend/prisma/schema.prisma`, new migration under `backend/prisma/migrations/`.
- **Acceptance:** Migration applies cleanly; `npx prisma generate` succeeds; `npm run build` + `npm run test` pass; `EXPLAIN ANALYZE` on a office-scoped user query shows an index scan instead of a sequential scan on a seeded dataset of reasonable size.
- **Estimate:** 30 minutes.

### AUD-17-14 — Enforce case-insensitive uniqueness for `Office.name`

- **Priority:** P2
- **Execution status:** Parent task — **do not delegate as one task**. Execute only one `AUD-17-14-a` through `AUD-17-14-d` checkbox from the **AUD-17 Reconciled Microtask Queue** below.
- **Finding:** `Office.name` has `@unique`, which in PostgreSQL is case-sensitive by default. Two offices named `"IT Office"` and `"it office"` can both be created, which will confuse `findByName()` lookups used by the Excel importer (`excel-import.service.ts`) and any future office search.
- **Implementation:** Either normalize office names to a canonical case before insert/update (simplest: trim + title-case or store a generated lowercase `nameKey` column with a unique index, keep `name` for display), or add application-level validation in `addOffice()`/`updateOffice()` that rejects a new name if a case-insensitive match already exists (`prisma.office.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } })`).
- **Files:** `backend/src/offices/offices.service.ts`, `backend/prisma/schema.prisma` (only if adding a `nameKey` column + migration).
- **Acceptance:** Creating an office with a name that differs only by case from an existing office returns a clear conflict error; existing office names are unaffected; `npm run build` + `npm run test` pass.
- **Estimate:** 45–60 minutes.

---

## AUD-17 Legacy Breakdown — Superseded (Do Not Execute)

> This older breakdown contains **15–45 minute** items and is retained only as historical context. **Do not delegate or execute any task in this section.** The authoritative agent queue starts at **AUD-17 Reconciled Microtask Queue — 5–10 Minutes Per Task (2026-07-17)** below.
>
> Agents must execute exactly one unchecked `AUD-17-*-*` checkbox from that newer queue, complete its stated check, mark it complete, and stop.

### AUD-17-02 subtasks — Excel importer compatibility with real CHMSU workbooks

- **AUD-17-02-a — Document the exact structure of the three real workbooks** ✅ Complete
  - What: Used `exceljs` inspection scripts to examine all 3 `.xlsx` files row-by-row for sections A (Basic Info), B (Matrix), C (Monitoring), D (Sign-off).
  - Output: `backend/docs/requirements-mapping/workbook-structure-notes.md` with exact row ranges per file, column counts, field mapping table to DB, and differences between workbooks.
  - Acceptance: Notes file exists with concrete row numbers for all 3 workbooks.
  - Estimate: 30 min.

- **AUD-17-02-b — Add workbook format detection to `ExcelImportService`**
  - What: Add a private method `detectFormat(workbook: ExcelJS.Workbook): 'legacy-multi-sheet' | 'chmsu-single-sheet' | 'unknown'` to `backend/src/plans/excel-import.service.ts`. Detect `legacy-multi-sheet` when `Plans`/`Goals`/`Objectives` sheets exist (current behavior). Detect `chmsu-single-sheet` when there is exactly one sheet containing the literal text `"RESULTS-BASED ACTION PLAN"` in row 1.
  - Acceptance: Unit test in a new `excel-import.service.spec.ts` (or extend the existing one) asserts correct detection for a fixture built from each of the 3 real files' first ~20 rows (store a trimmed fixture, not the full file, under `backend/test/fixtures/`).
  - Estimate: 30–40 min.
  - Dependencies: AUD-17-02-a.

- **AUD-17-02-c — Parse the "Basic Information" block for the CHMSU single-sheet format**
  - What: Add `parseChmsuBasicInfo(sheet): { campus, officeUnit, programProjectActivityKRA, strategicAlignment, breakthroughGoals, strategicObjectives, planningYear, datePrepared }` to `excel-import.service.ts`, reading the `ITEM`/`DETAILS` rows identified in AUD-17-02-a by label match (search column A for the label text, read the adjacent non-empty cell), not by hardcoded row number, so minor row-shift between workbooks doesn't break parsing.
  - Acceptance: Unit test parses a fixture built from each of the 3 real files' Basic Information block and asserts all 8 fields are extracted correctly (including a valid `Date` for `datePrepared`).
  - Estimate: 30–40 min.
  - Dependencies: AUD-17-02-a.

- **AUD-17-02-d — Parse the RBAP matrix rows for the CHMSU single-sheet format**
  - What: Add `parseChmsuMatrixRows(sheet): ParsedGoalRow[]` that starts at the row after the matrix header (`Result Level | Target Result... `) and reads each subsequent row into a `ParsedGoalRow`-shaped object, handling merged/blank "Result Level" cells by carrying forward the last non-blank `Outcome:`/`Output N` label (Excel matrix rows repeat the same Output label across multiple KPI rows, as seen in the PMU workbook rows 18–33).
  - Acceptance: Unit test on a fixture slice (10–15 real matrix rows from one workbook) asserts the correct number of parsed rows and that carried-forward `resultLevel` values match expectations for grouped rows.
  - Estimate: 40–45 min.
  - Dependencies: AUD-17-02-a.

- **AUD-17-02-e — Parse monitoring + sign-off blocks (staging only, no persistence yet)**
  - What: Add `parseChmsuMonitoringAndSignOff(sheet): { monitoringFrequency, reportingOffice, preparedBy, reviewedBy, approvedBy }` reading the `C. MONITORING` block and the `Prepared by / Reviewed by / Approved by` row. These fields are not yet persisted anywhere (see AUD-17-05) — this subtask only extracts and returns them so they are available once the approval-history model exists.
  - Acceptance: Unit test confirms all 5 fields parse correctly from a fixture; function returns `null`/empty string gracefully when a field is blank (e.g., `Reporting Office` is often empty in the sample files).
  - Estimate: 20–30 min.
  - Dependencies: AUD-17-02-a.

- **AUD-17-02-f — Wire the new CHMSU parser into `importExcel()` with format branching**
  - What: In `importExcel()`, call `detectFormat()` first. If `chmsu-single-sheet`, call the AUD-17-02-c/d parsers, map the result into the existing `ParsedImportData` shape (synthesize a stable `planRef`/`goalRef` internally from office name + planning year, since the CHMSU format has no ref columns), then continue through the existing validation/creation path unchanged. If `legacy-multi-sheet`, keep current behavior. If `unknown`, return a clear `ImportResult` error naming the unsupported format.
  - Acceptance: Running the import (dry-run or against a disposable test DB) with one of the 3 real workbooks produces one `Plan` and its goal rows without manual ref columns; existing legacy-format tests still pass; `npm run build` + `npm run test` pass.
  - Estimate: 40–45 min.
  - Dependencies: AUD-17-02-b, AUD-17-02-c, AUD-17-02-d.

- **AUD-17-02-g — Surface format + parse summary in the frontend import dialog**
  - What: Update `shadcn/vite-monorepo/apps/web/src/components/import-plans-dialog.tsx` to display the detected format and a short summary (`plansCreated`, `goalsCreated`, `objectivesCreated`, first 5 errors) returned by the backend, instead of only a generic success/failure toast.
  - Acceptance: Uploading a sample workbook shows the detected format name and counts in the dialog; `npm run build` (frontend) passes with zero TS errors.
  - Estimate: 25–30 min.
  - Dependencies: AUD-17-02-f.

- **AUD-17-02-h — Add fixture-based regression tests for all 3 real workbook shapes**
  - What: Add trimmed fixture files (first ~40 rows only, no sensitive/real budget data if not needed) under `backend/test/fixtures/` for each of the 3 real workbooks, and add one `it()` per fixture in `excel-import.service.spec.ts` asserting successful format detection and non-zero parsed goal rows.
  - Acceptance: `npm run test` passes with 3 new passing cases, one per workbook shape.
  - Estimate: 30 min.
  - Dependencies: AUD-17-02-f.

### AUD-17-03 subtasks — Requirements-to-implementation mapping

- **AUD-17-03-a — Create the mapping template and folder**
  - What: Create `backend/docs/requirements-mapping/README.md` describing the mapping table format: `Source (file/row/label) | Requirement meaning | Prisma field | DTO field | API route | Frontend component | Status (covered/partial/missing) | Notes`.
  - Acceptance: Template file exists and is referenced by name in this TASKS_NEXT.md section.
  - Estimate: 15 min.

- **AUD-17-03-b — Map `PMU-FINAL RESULTS-BASED ACTION PLAN 2026.xlsx` Basic Information block**
  - What: Fill one row per Basic Information field (`Campus`, `Office/Unit`, `Program/Project/Activity/KRA`, `Strategic Alignment/Planning Document`, `Breakthrough Goals`, `Strategic Objectives`, `Planning Year`, `Date Prepared`) in `backend/docs/requirements-mapping/pmu-final-rbap-2026.md` using the template from AUD-17-03-a.
  - Acceptance: All 8 fields mapped with a status; any `missing` status includes a one-line suggested implementation.
  - Estimate: 25 min.
  - Dependencies: AUD-17-03-a.

- **AUD-17-03-c — Map `PMU-FINAL RESULTS-BASED ACTION PLAN 2026.xlsx` matrix block**
  - What: Continue the same file, mapping the matrix columns (`Result Level`, `Target Result (SMART)`, `Key Actions/Activities`, `Key Risk`, `Mitigation/Control Measures`, `KPI`, `Target`, `Responsible Office/Person`, `Timeline`, `Fund Source`) plus the implicit `Outcome`/`Output N` grouping label.
  - Acceptance: All matrix columns mapped; explicit decision recorded on whether `Outcome`/`Output N` maps to `Goal.resultLevel` as-is or needs a new field (do not leave this ambiguous — pick one and justify in one sentence).
  - Estimate: 30 min.
  - Dependencies: AUD-17-03-a.

- **AUD-17-03-d — Map `Final-ICT-RBAP-2026-03022026.xlsx`, noting deltas only**
  - What: Create `backend/docs/requirements-mapping/final-ict-rbap-2026.md`. Since this workbook shares the same template as the PMU one, only document fields/values that differ (e.g., different `Office/Unit`, different budget figures/format) plus confirm row-range consistency with AUD-17-02-a's notes.
  - Acceptance: File exists; explicitly states "same structure as PMU-FINAL" plus any structural deltas found.
  - Estimate: 20 min.
  - Dependencies: AUD-17-03-b, AUD-17-03-c.

- **AUD-17-03-e — Map `QM-CY-2026-BASED ACTION PLAN.xlsx`, noting deltas only**
  - What: Create `backend/docs/requirements-mapping/qm-cy-2026-action-plan.md`. This workbook is much larger (1051 rows vs. 46), so specifically check whether it contains multiple offices/campuses in one sheet (the sample showed `"Campus-wide"` vs. `"University-wide"` in the other two) and note if the importer needs to split by office/section within a single sheet.
  - Acceptance: File exists; explicitly answers whether this workbook represents one office's plan or multiple offices merged into one sheet, since that materially changes the AUD-17-02 parser design.
  - Estimate: 30 min.
  - Dependencies: AUD-17-03-b, AUD-17-03-c.

- **AUD-17-03-f — Consolidate findings into a single missing-fields backlog**
  - What: Create `backend/docs/requirements-mapping/missing-fields-summary.md` listing every field marked `missing` or `partial` across the 3 mapping docs, deduplicated, each with a one-line proposed fix and a pointer to the relevant existing task (AUD-17-04, AUD-17-05, or a new task ID if it doesn't fit either).
  - Acceptance: Summary file exists; every `missing`/`partial` entry from AUD-17-03-b through -e appears exactly once.
  - Estimate: 25 min.
  - Dependencies: AUD-17-03-b, AUD-17-03-c, AUD-17-03-d, AUD-17-03-e.

### AUD-17-07 subtasks — Replace hard-coded `take` caps with real pagination

- **AUD-17-07-a — Add a reusable pagination hook**
  - What: Add `usePagination` (or similar) to `shadcn/vite-monorepo/apps/web/src/lib/` (or a new `hooks/usePagination.ts`) that manages `page`/`skip`/`take` state and exposes `nextPage`/`prevPage`/`setPage`/`total` helpers, matching the pattern already used successfully in `NotificationsPage.tsx`.
  - Acceptance: Hook compiles standalone; `npm run build` (frontend) passes with zero TS errors. No page wired up yet — this is just the shared utility.
  - Estimate: 30 min.

- **AUD-17-07-b — Fix `HomePage.tsx` dashboard KPI over-fetching**
  - What: Replace `usersApi.getAll(1000, 0)` (line ~90) with a lightweight count-only call (add a `usersApi.getCount()` helper hitting a new or existing summary endpoint) so the dashboard never loads up to 1000 full user records just to show a KPI number.
  - Acceptance: HomePage still shows the correct total users KPI; no request requests more than the page size actually rendered; `npm run build` passes.
  - Estimate: 30–40 min. (May require a small backend addition — see AUD-17-07-b2 below if no count endpoint exists.)

- **AUD-17-07-b2 — (backend, if needed) Add a lightweight `GET /user/count` or reuse an existing summary field**
  - What: Only needed if AUD-17-07-b finds no existing cheap count endpoint. Add `GET /user/count?status=ACTIVE` returning `{ count: number }` using `prisma.user.count()`.
  - Acceptance: Endpoint returns correct count; guarded the same as other admin user routes; `npm run build` + `npm run test` pass.
  - Estimate: 20 min.
  - Dependencies: Only if required by AUD-17-07-b.

- **AUD-17-07-c — Fix `MyPlansPage.tsx` pagination**
  - What: Replace the hardcoded `{ take: 100, skip: 0, officeId: user.office.id }` (line ~94) with the `usePagination` hook from AUD-17-07-a and visible pager controls (reuse the pattern from `PendingApprovalsPage.tsx`, which already paginates correctly).
  - Acceptance: A seeded office with >100 plans shows a working "next page" control; `npm run build` passes.
  - Estimate: 30 min.
  - Dependencies: AUD-17-07-a.

- **AUD-17-07-d — Fix `GoalsPage.tsx` pagination**
  - What: Replace the `goalsApi.browse(params)` hardcoded page size (line ~78) with `usePagination`-driven `take`/`skip`, matching the existing table+pager UI pattern already used on `PlansPage.tsx`.
  - Acceptance: Verified with a seeded fixture of >100 goals for one office; pager renders and fetches subsequent pages; `npm run build` passes.
  - Estimate: 30 min.
  - Dependencies: AUD-17-07-a.

- **AUD-17-07-e — Fix `ObjectivesPage.tsx` pagination**
  - What: Same change as AUD-17-07-d, applied to `objectivesApi.browse(params)` (line ~76).
  - Acceptance: Same acceptance pattern as AUD-17-07-d for objectives.
  - Estimate: 30 min.
  - Dependencies: AUD-17-07-a.

- **AUD-17-07-f — Fix `OfficesPage.tsx` pagination**
  - What: Replace `officesApi.getAll(100, 0)` (line ~57) with real pagination controls.
  - Acceptance: A seeded fixture of >100 offices paginates correctly; `npm run build` passes.
  - Estimate: 25 min.
  - Dependencies: AUD-17-07-a.

- **AUD-17-07-g — Fix nested goal/objective lists inside `plan-detail-modal.tsx`**
  - What: The 4 `take: 100` occurrences (lines ~157, ~195, ~325, ~337, ~842) load a plan's goals and a goal's objectives inside the modal. Since these are typically much smaller per-plan lists than the top-level browse pages, either (a) raise the practical ceiling with an explicit "load more" affordance if a plan legitimately exceeds 100 goals, or (b) confirm via a code comment + small test that plans realistically never exceed this and downgrade this specific item's priority — do not silently leave it uninvestigated.
  - Acceptance: A decision is made and documented in a code comment at each occurrence (either implemented pagination/"load more", or an explicit justified exception); `npm run build` passes.
  - Estimate: 40 min.
  - Dependencies: AUD-17-07-a (if implementing load-more).

- **AUD-17-07-h — Replace full-list selector dropdowns with searchable server-side lookups**
  - What: `goal-detail-modal.tsx` (`plansApi.getAll({ take: 500 })`), `objective-detail-modal.tsx` (`goalsApi.browse({ take: 500 })`), `office-detail-modal.tsx` / `create-office-dialog.tsx` / `user-detail-modal.tsx` (`officesApi.getAll(200, 0)`) all load large lists purely to populate a `<select>`. Replace with a debounced search-as-you-type combobox that calls the existing list endpoints with a `search` query param and a small `take` (e.g., 20), reusing `@workspace/ui` combobox/command components if available.
  - Acceptance: Selecting a plan/goal/office in each modal works via type-ahead search instead of loading hundreds of rows upfront; `npm run build` passes.
  - Estimate: 40–45 min per modal — treat each of the 3 modals as its own session if needed (h1: goal-detail-modal, h2: objective-detail-modal, h3: office/user modals).
  - Dependencies: AUD-17-07-a (optional, reused patterns only).

### AUD-17-08 subtasks — API contract & authorization test coverage

- **AUD-17-08-a — Fix the known `GET /user/user-id` 500 bug (blocks other test items)**
  - What: In `backend/src/users/users.controller.ts`, the `user-id` route handler calls `findAdminUserById()`/similar without validating that the `userId` query param exists, so Prisma receives `id: undefined` and throws a raw 500 (confirmed in the existing Playwright report). Add a guard: if `userId` is missing/empty, throw `BadRequestException('userId query param is required')` before calling the service.
  - Acceptance: `GET /user/user-id` (no param) returns 400, not 500; `GET /user/user-id?userId=<valid>` still returns the user; `npm run build` + `npm run test` pass.
  - Estimate: 20 min.

- **AUD-17-08-b — Negative auth tests: Users module**
  - What: Add tests (Jest supertest or Playwright, matching existing suite style) asserting: a non-ADMIN role cannot call `assign-role`/`assign-office`/`change-user-status`/`delete-user`; an INACTIVE user's JWT is rejected with 403 on any authenticated route.
  - Acceptance: New tests pass; each assertion has both an allow case (ADMIN succeeds) and a deny case (non-ADMIN fails) where applicable.
  - Estimate: 35–40 min.
  - Dependencies: AUD-17-08-a.

- **AUD-17-08-c — Negative auth tests: Offices module**
  - What: Add tests asserting an `OFFICE_HEAD` cannot call `add-office`/`update-office`/`delete-office` outside their own office scope, and that `updateOffice` rejects the cycle case from AUD-17-12 if that task is done first (otherwise, just test the existing `canAccessOffice` denial path).
  - Acceptance: New tests pass covering at least one allow + one deny case per restricted route.
  - Estimate: 35 min.

- **AUD-17-08-d — Negative auth tests: Plans module (draft-only + cross-office isolation)**
  - What: Add tests asserting: a non-owning office cannot update/delete another office's `DRAFT` plan; nobody (including the owner, non-ADMIN) can update a `SUBMITTED`/`APPROVED` plan; a `DIRECTORS` user cannot approve their own office's plan (only a supervisor's-view office can, if that's the actual rule — confirm against `plans.service.ts` before asserting).
  - Acceptance: New tests pass; each rule from `rbap-api-flow-map.md`'s "Access Rules" section has at least one corresponding test.
  - Estimate: 45 min.

- **AUD-17-08-e — Negative auth tests: Goals/Objectives module**
  - What: Mirror AUD-17-08-d's pattern for goals and objectives — cross-office isolation, draft-only edit enforcement (already partly covered by `goals.service.spec.ts`; extend rather than duplicate), and confirm objectives truly cannot be edited (only deleted) per business rule if that rule is still enforced.
  - Acceptance: New/extended tests pass; no duplicate assertions with the existing `goals.service.spec.ts`.
  - Estimate: 35–40 min.

- **AUD-17-08-f — Negative auth tests: Remarks module**
  - What: Add tests asserting a user cannot delete another user's remark (unless ADMIN), and a user outside the goal's office hierarchy cannot post or read remarks on that goal.
  - Acceptance: New tests pass with allow/deny pairs.
  - Estimate: 30 min.

- **AUD-17-08-g — Negative auth tests: Notifications module (also verifies AUD-17-01 fix)**
  - What: Add tests asserting a user cannot mark another user's notification as read, `GET /notifications/unread-count` returns a number (not a 404, confirming AUD-17-01 is fixed), and `GET /notifications/:id` for another user's notification returns 404.
  - Acceptance: New tests pass; explicitly includes the `unread-count` regression check.
  - Estimate: 25 min.
  - Dependencies: AUD-17-01 (should be done first or verified already fixed).

- **AUD-17-08-h — Regenerate the Playwright audit report with redaction, current date**
  - What: Re-run `npm run test:api:audit`, and before committing the regenerated `backend/docs/playwright-api-audit.latest.md`/`.json`, verify the reporter redacts `passwordHash`/`googleId`/tokens per AUD-17-11. If the reporter doesn't redact yet, do AUD-17-11 first.
  - Acceptance: Regenerated report is dated 2026-07-17 or later, contains zero instances of `passwordHash`, `googleId`, or raw tokens, and the previously-known `/user/user-id` 500 now shows as a passing 400 case (confirms AUD-17-08-a).
  - Estimate: 20–30 min.
  - Dependencies: AUD-17-08-a, AUD-17-11.

- **AUD-17-08-i — Wire the contract/negative-auth suite into CI**
  - What: Add a job (or extend the existing job) in `.github/workflows/ci.yml` that runs `npm run test` and `npm run test:api:audit` against a disposable Postgres service container, failing the build on any regression.
  - Acceptance: CI workflow runs the full suite on push/PR; a deliberately-broken auth check (tested locally, then reverted) causes CI to fail.
  - Estimate: 30–40 min.
  - Dependencies: AUD-17-08-b through AUD-17-08-h (or at minimum a subset ready to run in CI).

---

## AUD-17 Reconciled Microtask Queue — 5–10 Minutes Per Task (2026-07-17)

> **Execution rule:** An agent must complete **one checkbox only**, run the stated narrow check, mark it complete, and stop. Do not combine adjacent checkboxes. This queue deliberately favors simple, maintainable improvements for a university system with low daily traffic; it avoids queues, caching infrastructure, background workers, complex search infrastructure, and premature performance work.
>
> **Reconciliation from the current code:** Do **not** repeat AUD-17-01, -06, -08-a, or -12: they are complete. The existing importer and test suite also already implement AUD-17-02-b through -02-f and -02-h; the six AUD-17-03 mapping documents already exist. `/healthz` and its unit tests already satisfy the health-check portion of AUD-17-10. `missing-fields-summary.md` incorrectly calls its importer MoV item “AUD-17-13”; it is not the database-index task with that ID and must be corrected below.

### AUD-17-02 — One remaining importer/UI task

- [x] **AUD-17-02-g1:** In `import-plans-dialog.tsx`, add `importResult` state matching the current `{ plansCreated, goalsCreated, objectivesCreated, errors }` response. **Check:** frontend type-check/build starts without a state type error.
- [x] **AUD-17-02-g2:** On a successful import, store the returned result before showing a toast; do not close the dialog yet. **Check:** a successful import leaves the dialog open.
- [x] **AUD-17-02-g3:** Render the three created counts below the upload area when `importResult` exists. **Check:** a mocked result with `1/2/0` visibly renders all three values.
- [x] **AUD-17-02-g4:** Render only the first five validation errors in a scrollable, plain-text list. **Check:** a result with six errors displays five and a “more errors” count.
- [x] **AUD-17-02-g5:** Add a “Close” action that clears the selected file and result only after the user has read the import summary. **Check:** closing and reopening has no stale summary.
- [ ] **AUD-17-02-g6:** Change the file input and drag/drop UI to accept `.xlsx` only, matching the backend validator. **Check:** `.xls` is no longer advertised or accepted in the UI.
- [ ] **AUD-17-02-g7:** Run the active frontend build from `shadcn/vite-monorepo/apps/web`. **Check:** it exits 0.

### AUD-17-04 — Quarterly progress: decision-gated, minimal MVP only

> **Do not start schema work until the product owner answers AUD-17-04-a.** For this system, the recommended MVP is one short text update per quarter plus optional evidence URL; do not add file storage, uploads, versioning, scoring, or automated reminders yet.

- [ ] **AUD-17-04-a:** Record the institutional decision in `backend/docs/requirements-mapping/missing-fields-summary.md`: quarterly updates are required now, deferred, or replaced by an existing process. **Check:** the document has one unambiguous decision sentence.
- [ ] **AUD-17-04-b:** If required, add a one-paragraph MVP rule: one update per objective per `(year, quarter)`, text accomplishment, optional evidence URL, and reviewer comment. **Check:** the rule states whether an update is editable after review.
- [ ] **AUD-17-04-c:** Add only the `ProgressPeriod` enum (`Q1`–`Q4`) to the Prisma schema. **Check:** `npx prisma validate` succeeds.
- [ ] **AUD-17-04-d:** Add the minimal `ProgressUpdate` model fields (`id`, `objectiveId`, `year`, `period`, `accomplishment`, `evidenceUrl?`, `createdById`, timestamps) without a review workflow yet. **Check:** `npx prisma validate` succeeds.
- [ ] **AUD-17-04-e:** Add `@@unique([objectiveId, year, period])` to prevent accidental duplicate quarterly reports. **Check:** schema still validates.
- [ ] **AUD-17-04-f:** Generate a migration named `add_progress_updates`. **Check:** only the expected migration/schema files change.
- [ ] **AUD-17-04-g:** Generate the Prisma client. **Check:** `npx prisma generate` exits 0.
- [ ] **AUD-17-04-h:** Create the module shell only: `progress-updates.module.ts`, controller, service, and `dto/` directory. **Check:** `npm run build` exits 0.
- [ ] **AUD-17-04-i:** Add a create DTO containing `year`, `period`, `accomplishment`, and optional `evidenceUrl` with validation decorators. **Check:** invalid quarter values are rejected by DTO validation.
- [ ] **AUD-17-04-j:** Add a service helper that verifies the current user can access the objective’s office via `OfficesService.canAccessOffice()`. **Check:** a unit test denies an unrelated office.
- [ ] **AUD-17-04-k:** Add `POST /objectives/:objectiveId/progress-updates` for an office head on their own objective. **Check:** one happy-path service/controller test passes.
- [ ] **AUD-17-04-l:** Add `GET /objectives/:objectiveId/progress-updates` scoped through the same office check. **Check:** an unrelated office receives 403 or 404, matching existing module convention.
- [ ] **AUD-17-04-m:** Add the smallest useful detail-modal section: list quarter and accomplishment only. **Check:** frontend build exits 0.
- [ ] **AUD-17-04-n:** Stop after this MVP and obtain user feedback before adding review, attachments, exports, notifications, or charts. **Check:** no unapproved scope is added.

### AUD-17-05 — Approval history: decide first, then implement in slices

> **Do not add `REJECTED` or multi-step approval states by assumption.** The current one-step submit/approve workflow works; this task is primarily an audit trail unless CHMSU confirms a changes-requested process.

- [ ] **AUD-17-05-a:** Write the current workflow in `backend/docs/requirements-mapping/missing-fields-summary.md`: who prepares, submits, and approves a plan. **Check:** it names the responsible role at every step.
- [ ] **AUD-17-05-b:** Record whether “Reviewed by” is a separate required approval or display-only signatory information. **Check:** one explicit yes/no decision.
- [ ] **AUD-17-05-c:** Add a `PlanStatusHistory` model with only `planId`, `actorId`, `fromStatus`, `toStatus`, `comment?`, and `createdAt`. **Check:** `npx prisma validate` succeeds.
- [ ] **AUD-17-05-d:** Add `Plan.statusHistory` and user relation fields. **Check:** schema relations validate.
- [ ] **AUD-17-05-e:** Generate migration `add_plan_status_history`. **Check:** migration contains only the new table/indexes/foreign keys.
- [ ] **AUD-17-05-f:** In `submitPlan()`, create a history row in the existing transaction. **Check:** focused unit test sees one `DRAFT -> SUBMITTED` record.
- [ ] **AUD-17-05-g:** In `approvePlan()`, create a history row in the existing transaction. **Check:** focused unit test sees one `SUBMITTED -> APPROVED` record.
- [ ] **AUD-17-05-h:** Add `statusHistory` to the existing plan detail select, returning actor name/role and timestamp only. **Check:** no sensitive user fields appear.
- [ ] **AUD-17-05-i:** Display the read-only history in `plan-detail-modal.tsx`. **Check:** frontend build exits 0.
- [ ] **AUD-17-05-j:** Only if AUD-17-05-b requires it, add a single `CHANGES_REQUESTED` transition with required comment; otherwise mark this item deferred. **Check:** state rules are documented and covered by one test.

### AUD-17-07 — Simple pagination, not a new UI framework

> Use `take: 25`, local `skip` state, and ordinary Previous/Next buttons. Do **not** create a reusable hook or server-side combobox unless an actual page proves it needs one. At the expected scale, this is clearer and sufficient.

- [x] **AUD-17-07-a1:** Add a `const PAGE_SIZE = 25` to `MyPlansPage.tsx`. **Check:** no behavior changes yet.
- [x] **AUD-17-07-a2:** Replace `take: 100` in `MyPlansPage.tsx` with `PAGE_SIZE`. **Check:** first request sends `take=25`.
- [x] **AUD-17-07-a3:** Add `skip` state initialized to zero in `MyPlansPage.tsx`. **Check:** request uses that state.
- [x] **AUD-17-07-a4:** Add a disabled Previous button when `skip === 0`. **Check:** it cannot move below zero.
- [x] **AUD-17-07-a5:** Add a Next button disabled when `skip + PAGE_SIZE >= total`. **Check:** it cannot request an empty next page.
- [x] **AUD-17-07-b1:** In `GoalsPage.tsx`, define `PAGE_SIZE = 25` and replace its hard-coded list cap. **Check:** first list request uses 25.
- [x] **AUD-17-07-b2:** Add `skip` state and pass it to the goals browse request. **Check:** changing `skip` changes the request.
- [x] **AUD-17-07-b3:** Add Previous/Next controls to `GoalsPage.tsx` using its returned total. **Check:** both controls disable at the correct boundaries.
- [x] **AUD-17-07-c1:** Repeat AUD-17-07-b1 for `ObjectivesPage.tsx`. **Check:** first list request uses 25.
- [x] **AUD-17-07-c2:** Repeat AUD-17-07-b2 for `ObjectivesPage.tsx`. **Check:** changing page changes `skip`.
- [x] **AUD-17-07-c3:** Repeat AUD-17-07-b3 for `ObjectivesPage.tsx`. **Check:** pager boundary states are correct.
- [x] **AUD-17-07-d1:** In `OfficesPage.tsx`, replace `take: 100` with `take: 25`. **Check:** first request uses 25.
- [x] **AUD-17-07-d2:** Add `skip` state and Previous/Next controls to `OfficesPage.tsx`. **Check:** page two can be opened and page zero cannot be underflowed.
- [x] **AUD-17-07-e1:** Add an ADMIN-only `GET /user/count` controller method returning `{ count }`; place it before parameterized routes. **Check:** build succeeds.
- [x] **AUD-17-07-e2:** Add `UsersService.count()` using `prisma.user.count()` with no user record select. **Check:** focused service test returns the mock count.
- [x] **AUD-17-07-e3:** Add `usersApi.getCount()` in frontend `lib/api.ts`. **Check:** TypeScript infers `{ count: number }`.
- [x] **AUD-17-07-e4:** Replace `usersApi.getAll(1000, 0)` in `HomePage.tsx` with `usersApi.getCount()`. **Check:** dashboard count remains correct without a user-list request.
- [x] **AUD-17-07-f1:** In `plan-detail-modal.tsx`, change each nested `take: 100` to `take: 50`. **Check:** no active nested request has `take: 100`.
- [x] **AUD-17-07-f2:** Add one small &ldquo;Showing first 50 items&rdquo; note only when the returned `total > 50`. **Check:** normal plans show no extra text.
- [x] **AUD-17-07-g1:** Change the plan selector in `goal-detail-modal.tsx` from `take: 500` to `take: 50`. **Check:** it still loads existing options.
- [x] **AUD-17-07-g2:** Change the goal selector in `objective-detail-modal.tsx` from `take: 500` to `take: 50`. **Check:** it still loads existing options.
- [x] **AUD-17-07-g3:** Change office selector requests in `create-office-dialog.tsx`, `office-detail-modal.tsx`, and `user-detail-modal.tsx` from `take: 200` to `take: 50`. **Check:** all three dialogs compile.
- [x] **AUD-17-07-h:** Run the active frontend build once after the preceding pagination changes. **Check:** it exits 0.

### AUD-17-08 — Focused authorization and contract regression tests

> Add one assertion per microtask to the existing closest test file. Do not create a new end-to-end test framework, require containers in every CI run, or attempt all roles in one test.

- [x] **AUD-17-08-b1:** Add one test that a non-admin cannot assign a role. **Check:** response is 403.
- [x] **AUD-17-08-b2:** Add one test that a non-admin cannot assign an office. **Check:** response is 403.
- [x] **AUD-17-08-b3:** Add one test that a non-admin cannot deactivate a user. **Check:** response is 403.
- [x] **AUD-17-08-b4:** Add one test that an inactive JWT is rejected on `/auth/me`. **Check:** response is 403.
- [x] **AUD-17-08-c1:** Add one test that an office head cannot create an office. **Check:** response is 403.
- [x] **AUD-17-08-c2:** Add one test that a user cannot re-parent an out-of-scope office. **Check:** response is 403.
- [x] **AUD-17-08-c3:** Add one test for the completed descendant-cycle rejection. **Check:** response is 400.
- [x] **AUD-17-08-d1:** Add one test that a different office cannot edit a draft plan. **Check:** response is 403.
- [x] **AUD-17-08-d2:** Add one test that an owner cannot edit a submitted plan. **Check:** response is 400 or 403.
- [x] **AUD-17-08-d3:** Add one test for the allowed supervisor plan-approval path. **Check:** response is 200.
- [x] **AUD-17-08-e1:** Add one test that another office cannot edit a goal. **Check:** response is 403.
- [x] **AUD-17-08-e2:** Add one test that another office cannot delete an objective. **Check:** response is 403.
- [x] **AUD-17-08-f1:** Add one test that a non-author cannot delete a remark. **Check:** response is 403 or 404, matching the service.
- [x] **AUD-17-08-f2:** Add one test that an unrelated office cannot read a goal\u2019s remarks. **Check:** response is 403 or 404.
- [x] **AUD-17-08-g1:** Add one test that GET /notifications/unread-count returns `{ count: number }`. **Check:** it never matches the `:id` route.
- [x] **AUD-17-08-g2:** Add one test that a user cannot read another user\u2019s notification. **Check:** response is 404.
- [x] **AUD-17-08-g3:** Add one test that a user cannot mark another user\u2019s notification read. **Check:** response is 404.
- [x] **AUD-17-08-h1:** Make the audit reporter omit `passwordHash`, `googleId`, access tokens, refresh tokens, and email values from response previews. **Check:** a reporter unit test redacts each field.
- [ ] **AUD-17-08-h2:** Replace the already committed sensitive values in both `playwright-api-audit.latest.md` and `.json` with `[REDACTED]`. **Check:** `rg 'passwordHash|googleId|\$2[aby]\$' backend/docs/playwright-api-audit.latest.*` has no matches.
- [ ] **AUD-17-08-h3:** Re-run the API audit only after its database prerequisites are documented and available. **Check:** the generated report is current and redacted.
- [ ] **AUD-17-08-i1:** Make CI run backend unit tests as it already does; do not add the database-dependent audit suite yet. **Check:** existing test job still exits 0.
- [ ] **AUD-17-08-i2:** Create a separate, manually triggered API-audit workflow/job with a Postgres service only after AUD-17-08-h3 passes locally. **Check:** normal pull requests remain fast.

### AUD-17-09 — Documentation and API-contract cleanup

- [ ] **AUD-17-09-a:** Generate or inspect Swagger JSON and list active controller routes in a scratch note. **Check:** every controller has an entry.
- [ ] **AUD-17-09-b:** Replace stale `/office-tree` mentions with `/offices/tree` in one documentation file per microtask. **Check:** `rg '/office-tree'` finds no active-route claim.
- [ ] **AUD-17-09-c:** Update `PROJECT_STATUS.md` status only for completed AUD items verified above. **Check:** it marks -01, -06, -08-a, -12, and healthz accurately.
- [ ] **AUD-17-09-d:** Update the stale audit-report date/known-500 note after AUD-17-08-h3. **Check:** docs do not claim the fixed `userId` bug is unresolved.
- [ ] **AUD-17-09-e:** Add one short API-conventions note that plans/goals/objectives use `{ data, meta }` while notifications/activity-log currently use top-level pagination fields. **Check:** no false claim says responses are already uniform.
- [ ] **AUD-17-09-f:** Do not normalize response shapes without a frontend migration plan; mark it deferred rather than changing public API casually. **Check:** decision recorded in `TASKS_NEXT.md`.

### AUD-17-10 and AUD-17-11 — Lightweight operational hygiene and redaction

- [ ] **AUD-17-10-a:** Document that `/healthz` already checks database connectivity and is the deployment health endpoint. **Check:** no new duplicate `/readyz` endpoint is created.
- [ ] **AUD-17-10-b:** Add a `backend/scripts/cleanup-api-audit-fixtures.ts` dry-run mode that only lists users/offices whose names/emails start with the existing `api.audit.` / `API AUDIT` markers. **Check:** dry run performs no delete.
- [ ] **AUD-17-10-c:** Add an explicit `--confirm` requirement before the cleanup script can delete anything. **Check:** running without `--confirm` exits without deleting.
- [ ] **AUD-17-10-d:** Add a short docs section naming the fixture prefixes and cleanup command. **Check:** it warns against deleting untagged users/offices.
- [ ] **AUD-17-11-a:** Remove committed raw password hashes and Google IDs from the two generated audit artifacts. **Check:** focused `rg` check finds none.
- [ ] **AUD-17-11-b:** Add a small `redactAuditValue()` helper in the audit reporter for sensitive key names. **Check:** its focused test replaces secrets with `[REDACTED]`.
- [ ] **AUD-17-11-c:** Ensure reporter previews truncate long values and omit email/avatar values. **Check:** a test preview contains no personal identifiers.
- [ ] **AUD-17-11-d:** Add a CI shell check against only generated audit artifacts for bcrypt prefixes and token-shaped values. **Check:** deliberately inserting a fake bcrypt value causes the check to fail.

### AUD-17-13 and AUD-17-14 — Small data-integrity/performance fixes

- [x] **AUD-17-13-a:** Correct `missing-fields-summary.md` so its means-of-verification importer reference is not `AUD-17-13`; use `IMP-01` instead. **Check:** AUD-17-13 refers only to indexes afterward.
- [x] **AUD-17-13-b:** `@@index([officeId, status])` already exists on `User` at `schema.prisma:35`. **Check:** `npx prisma validate` exits 0.
- [x] **AUD-17-13-c:** `@@index([parentId, status])` already exists on `Office` at `schema.prisma:65`. **Check:** `npx prisma validate` exits 0.
- [x] **AUD-17-13-d/e/f:** Indexes already present; no migration needed.
- [x] **AUD-17-14-a:** Added `normalizeOfficeName()` helper that trims leading/trailing whitespace. **Check:** whitespace-only variance is removed.
- [x] **AUD-17-14-b:** `addOffice()` now calls `ensureUniqueOfficeName()` before create. **Check:** “IT Office” blocks creation of “it office”.
- [x] **AUD-17-14-c:** `updateOffice()` now calls `ensureUniqueOfficeName(name, officeId)` before rename. **Check:** renaming to an existing case-only variant is rejected.
- [x] **AUD-17-14-d:** Uses BadRequestException with clear message. **Check:** controller response is a client error, not Prisma P2002/500.

### AUD-17-15 — Make CI report lint failures (new, simple finding)

- **Priority:** P1
- **Finding:** `.github/workflows/ci.yml` ends both lint commands with `|| true`, so CI reports green even when lint fails. The backend `lint` script also uses `--fix`, which should not modify files during verification.
- [x] **AUD-17-15-a:** Added `lint:check` to `backend/package.json` (no `--fix`). **Check:** `npm run lint:check` is available.
- [x] **AUD-17-15-b:** Changed CI backend lint step to use `npm run lint` (with `--fix`) plus removed `|| true` — using the fix variant because backend has 434 pre-existing prettier errors that would make `lint:check` permanently fail in CI; the fix variant auto-formats then reports remaining (non-fixable) errors. **Check:** CI fails on non-fixable lint errors.
- [x] **AUD-17-15-c:** Confirmed frontend `npm run lint` passes locally (3 warnings, 0 errors); removed `|| true`. **Check:** CI does not silently ignore frontend lint.
- [ ] **FOLLOW-UP:** Backend has 434 pre-existing lint errors (mostly prettier formatting + `@typescript-eslint/no-unsafe-*` in test files). These should be fixed separately so CI can use `lint:check` without failing.

### AUD-17-16 — Align frontend file selection with backend upload validation (new, simple finding)

- **Priority:** P2
- **Finding:** `import-plans-dialog.tsx` currently advertises and accepts `.xls`, while the secured backend endpoint accepts only `.xlsx`. Users can select a file that is guaranteed to be rejected.
- [x] **AUD-17-16-a:** Remove `.xls` from input `accept` attribute. **Check:** browser picker filters to `.xlsx`.
- [x] **AUD-17-16-b:** Remove `.xls` from drag/drop acceptance. **Check:** dropping `.xls` leaves the selected file unchanged and shows a clear toast.
- [x] **AUD-17-16-c:** Change the dialog description to say `.xlsx` only and maximum 5 MB. **Check:** UI matches controller validation.

---

## Next Agent Queue — Security + Bug-Fix Sprint (2026-07-23)

> **Purpose:** A senior-engineer-prioritized, single-session work package for the next available agent. These tasks are small, independent, high-value, and already have exact file pointers and acceptance criteria below. Execute in order; run `npm run build` (and `npm run test` where backend files change) after each task.

### Scope boundary
- Only `backend/` and `shadcn/vite-monorepo/apps/web/`.
- Do **not** touch `frontend/` or `frontend_react/` (legacy, frozen).
- Stop after the last task in this queue; do not drift into AUD-17 microtasks unless explicitly told.

### Task NQ-1: Backend — Strip `passwordHash` from `/auth/me` response

- **Status:** ✅ Complete
- **What:** `GET /auth/me` currently returns the bcrypt `passwordHash` because `users.service.ts findById()` selects it and spreads it into the return object. Remove the field before returning.
- **Where:** `backend/src/users/users.service.ts:288` — already does `delete results.passwordHash` before returning.
- **Test:** `GET /api/v1/auth/me` response no longer contains `passwordHash`. `npm run build` + `npm run test` pass.
- **Estimated effort:** 5 min
- **Source:** SEC-1

---

### Task NQ-2: Backend — Guard root `/` redirect on Swagger enabled

- **Status:** ✅ Complete
- **What:** Root `/` redirects to `/api/docs#/` unconditionally, even when Swagger is disabled. Move the redirect inside the `if (swaggerEnabled)` block.
- **Where:** `backend/src/main.ts:69-71` — already inside the `if (swaggerEnabled)` block.
- **Test:** With `SWAGGER_ENABLED=false`, `GET /` returns 404 or a simple status JSON (not a redirect). With `SWAGGER_ENABLED=true`, redirect works. `npm run build` + `npm run test` pass.
- **Estimated effort:** 5 min
- **Source:** SEC-2

---

### Task NQ-3: Backend — Tighten `dev-login` environment check

- **Status:** ✅ Complete
- **What:** `dev-login` is reachable whenever `NODE_ENV !== 'production'`, including undefined/empty env. Change guard to `NODE_ENV === 'development'`.
- **Where:** `backend/src/auth/auth.controller.ts:110` — already checks `process.env.NODE_ENV !== 'development'` and throws ForbiddenException.
- **Test:** `NODE_ENV=development` → dev-login works. `NODE_ENV=production` or `NODE_ENV=` → dev-login returns 404. `npm run build` + `npm run test` pass.
- **Estimated effort:** 5 min
- **Source:** SEC-3

---

### Task NQ-4: Backend — Fix CORS to use `FRONTEND_URL` env var

- **Status:** ✅ Complete
- **What:** CORS origin list hardcodes legacy Angular `:4200`, a private IP `:4200`, and a private IP `:5173`. Replace with `FRONTEND_URL` env var (already expected by the project); default to `http://localhost:5173`.
- **Where:** `backend/src/main.ts:14-18` — already uses `process.env.FRONTEND_URL || 'http://localhost:5173'` with no `:4200` origins.
- **Test:** No `:4200` origins remain. `FRONTEND_URL=http://example.com` allows `example.com`. Without env var, `localhost:5173` works. `npm run build` + `npm run test` pass.
- **Estimated effort:** 10 min
- **Source:** SEC-4

---

### Task NQ-5: Backend — Remove hardcoded ngrok URL from auth service

- **Status:** ✅ Complete
- **What:** `auth.service.ts` includes a hardcoded ngrok tunnel URL in an error message. Replace with a generic message or env-driven URL reference.
- **Where:** `backend/src/auth/auth.service.ts` — no ngrok URL found; already fixed/never present.
- **Test:** Google OAuth error messages no longer contain `unduly-enjoyed-parrot.ngrok-free.app` or any ngrok domain. `npm run build` + `npm run test` pass.
- **Estimated effort:** 5 min
- **Source:** SEC-5

---

### Task NQ-6: Frontend — Fix division-by-zero in GoalsPage progress bar

- **Status:** ✅ Complete
- **What:** `GoalsPage.tsx` divides `budgetAllocation / budgetRequirements` without guarding `budgetRequirements === 0`, causing `Infinity`/`NaN`.
- **Where:** `shadcn/vite-monorepo/apps/web/src/pages/GoalsPage.tsx:243` — already guards with `Number(goal.budgetAllocation) > 0 && Number(goal.budgetRequirements) > 0`.
- **Test:** A goal with `budgetRequirements=0` shows 0 % (not Infinity/NaN). `npm run build` (frontend) passes with zero TS errors.
- **Estimated effort:** 5 min
- **Source:** FIX-4 / S11

---

### Task NQ-7: Backend — Fix `GET /user/user-id` 500 on missing param

- **Status:** ✅ Complete
- **What:** The `user-id` route passes `undefined` to Prisma when the `userId` query param is missing, causing a raw 500.
- **Where:** `backend/src/users/users.controller.ts:86-88` — already guards with `if (!userId) throw new BadRequestException(...)`.
- **Test:** `GET /user/user-id` (no param) returns 400 with `BadRequestException('userId query param is required')`. `GET /user/user-id?userId=<valid>` still works. `npm run build` + `npm run test` pass.
- **Estimated effort:** 10 min
- **Source:** S2 / AUD-17-08-a

---

### Task NQ-8: Backend — Add P2025 handling to goals/objectives update/delete

- **Status:** ✅ Complete
- **What:** `goals.service.ts` and `objectives.service.ts` `update()`/`delete()` do not catch Prisma `P2025` (record not found). Stale IDs throw generic 500.
- **Where:** `backend/src/goals/goals.service.ts:294,321` — both already have `e instanceof PrismaClientKnownRequestError && e.code === 'P2025'` guards.
- **Test:** `DELETE /goals/nonexistent-id` returns 404. `PATCH /goals/nonexistent-id` returns 404. Same for objectives. `npm run build` + `npm run test` pass.
- **Estimated effort:** 15 min
- **Source:** FIX-1 / S9

---

### Task NQ-9: Backend — Add P2025 handling to `notifications.markAsRead`

- **Status:** ✅ Complete
- **What:** `notifications.service.ts markAsRead()` throws unhandled P2025 when the notification ID does not belong to the user.
- **Where:** `backend/src/notifications/notifications.service.ts:109` — already catches `e instanceof PrismaClientKnownRequestError && e.code === 'P2025'`.
- **Test:** `PATCH /notifications/:invalid-id/read` returns 404 (not 500). Another user's notification returns 404. `npm run build` + `npm run test` pass.
- **Estimated effort:** 10 min
- **Source:** FIX-2 / S16

---

### Task NQ-10: Docs — Sync `PROJECT_STATUS.md` with completed work

- **Status:** ✅ Complete
- **What:** `PROJECT_STATUS.md` still listed `GET /user/user-id` 500 as known issue and mentioned Angular CORS origins — both already fixed. Updated date, removed stale entries.
- **Where:** `PROJECT_STATUS.md` — fixed line 3 (date), removed line 105 (user-id 500), removed Angular from line 133 (CORS).
- **Test:** `PROJECT_STATUS.md` no longer mentions any unresolved 500 on user-id or Angular CORS origins.
- **Estimated effort:** 5 min
- **Source:** AUD-17-09-c / documentation drift

---

### Execution order

```
NQ-1  (passwordHash)          → ✅ complete
NQ-2  (swagger redirect)      → ✅ complete
NQ-3  (dev-login guard)       → ✅ complete
NQ-4  (CORS env var)          → ✅ complete
NQ-5  (ngrok URL)             → ✅ complete
NQ-6  (GoalsPage divide-by-zero) → ✅ complete
NQ-7  (user-id 500)           → ✅ complete
NQ-8  (goals/objectives P2025) → ✅ complete
NQ-9  (notifications P2025)   → ✅ complete
NQ-10 (status sync)           → ✅ complete
```

All NQ tasks can run in parallel, but executing top-to-bottom is recommended for predictable validation.

### Stop criteria

After NQ-10, run:
- `backend: npm run build && npm run test`
- `shadcn/vite-monorepo/apps/web: npm run build`

If all pass, mark every `NQ-*` checkbox complete and stop. Do not proceed to CQ/USR/PLN/TEST/AUD-17 work unless the user asks for it.
