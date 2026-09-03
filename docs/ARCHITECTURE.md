# CHMSU RBAP IDM — System Architecture & Onboarding Guide

> **Carlos Hilado Memorial State University (CHMSU)**  
> **Institutional Dashboard Monitoring (IDM) for Results-Based Action Plans (RBAP)**

---

## 🏛 1. Core Domain Hierarchy

The RBAP IDM domain centers around university organizational planning. All operational targets flow through an office-centric relational structure:

```text
                               ┌─────────────────────────┐
                               │         Office          │
                               │  (Self-referencing tree)│
                               └────────────┬────────────┘
                                            │ 1:N
                               ┌────────────▼────────────┐
                               │          User           │
                               │  (Role & Office FK)     │
                               └────────────┬────────────┘
                                            │ 1:N
                               ┌────────────▼────────────┐
                               │          Plan           │
                               │ (Unique office/year)    │
                               └────────────┬────────────┘
                                            │ 1:N
                               ┌────────────▼────────────┐
                               │          Goal           │
                               │ (Budget requirements)   │
                               └────────────┬────────────┘
                                            │ 1:N
                               ┌────────────▼────────────┐
                               │        Objective        │
                               │ (Status & Target date)  │
                               └────────────┬────────────┘
                                            │ 1:N
                               ┌────────────▼────────────┐
                               │         Remark          │
                               │ (Comments & Feedback)   │
                               └─────────────────────────┘
```

---

## 🔐 2. Hierarchical Role Visibility & Scope Logic

Data access across plans, goals, objectives, and dashboard endpoints is strictly evaluated using the office organizational tree. This logic is centralized in `backend/src/offices/offices.service.ts`.

```text
[ADMIN / PRESIDENTS] (Level 3-4)
       │  All Active Offices (Full Read / Administrative Approval)
       ▼
[VICE_PRESIDENTS] (Level 2)
       │  Own Office + Subtree Offices
       ▼
[DIRECTORS] (Level 1)
       │  Own Office + Direct Child Offices
       ▼
[OFFICE_HEAD] (Level 0)
          Own Office Only
```

### Scope Helper Methods (`offices.service.ts`):
- `getAccessibleOfficeIds(user)` — Computes the set of office IDs the user is authorized to view based on their role and assigned office position.
- `canAccessOffice(user, targetOfficeId)` — Evaluates whether a user can read data belonging to `targetOfficeId`.
- `canWriteOffice(user, targetOfficeId)` — Evaluates whether a user can mutate/edit data belonging to `targetOfficeId`.

---

## 🔄 3. Visual Execution Flow Maps

### A. Google OAuth2 Authentication & Session Flow

```text
[1. User clicks "Sign in with Google"]
  │
  ├─► Frontend: LoginPage.tsx -> handleGoogleLogin()
  │     └─► window.location.href = 'http://localhost:3000/api/v1/auth/google'
  │
[2. Backend NestJS Auth Route]
  │
  ├─► AuthController.googleAuth() [@UseGuards(GoogleAuthGuard)]
  │     └─► Redirects browser to accounts.google.com
  │
[3. Google OAuth Callback]
  │
  ├─► GET /api/v1/auth/google/callback -> AuthController.googleCallback()
  │     ├─► AuthCallbackService.validateGoogleUser()
  │     │     ├─► Validates domain requirement (@chmsu.edu.ph)
  │     │     └─► Finds/links User by email in Prisma DB
  │     │
  │     └─► Issues JWT Access Token (15m) & Refresh Token (7d)
  │           └─► Redirects browser: http://localhost:5173/auth/callback?token=...&refresh=...
  │
[4. Frontend Callback Receiver]
  │
  └─► AuthCallbackPage.tsx -> useEffect()
        ├─► Extract tokens from URL search params
        ├─► Save to localStorage (`access_token`, `refresh_token`)
        ├─► AuthContext.tsx -> fetchUser() -> GET /api/v1/auth/me
        └─► router.navigate('/dashboard')
```

---

### B. Plan Creation & Submission Workflow

```text
[1. Office Head fills form in PlanDetailModal]
  │
  ├─► Frontend: PlanDetailModal.tsx -> handleCreatePlan()
  │     └─► POST /api/v1/plans { officeId, planningYear, title }
  │
[2. Backend Controller & Service]
  │
  ├─► PlansController.create() [@UseGuards(JwtAuthGuard, RolesGuard)]
  │     └─► PlansService.create()
  │           ├─► Validates unique constraint on (officeId, planningYear)
  │           ├─► Creates Plan with state = 'DRAFT'
  │           └─► Writes event to ActivityLogService
  │
[3. Office Head submits Plan for review]
  │
  ├─► Frontend: PlanDetailModal.tsx -> handleSubmitPlan()
  │     └─► PATCH /api/v1/plans/:id/submit
  │
[4. Plan State Update & Notification Trigger]
  │
  └─► PlansService.submitPlan()
        ├─► Updates Plan status: DRAFT -> SUBMITTED
        ├─► Finds supervising Director/VP office head
        ├─► NotificationsService.createNotification()
        └─► Returns updated Plan
```

---

### C. Remark Posting & Upward Notification Chain

```text
[1. User posts remark on Goal]
  │
  ├─► Frontend: GoalDetailModal.tsx -> handleAddRemark()
  │     └─► POST /api/v1/plans/:planId/goals/:goalId/remarks { content }
  │
[2. Backend Remarks Service]
  │
  ├─► RemarksController.create()
  │     └─► RemarksService.create()
  │           ├─► Verifies user has access to Goal's Office
  │           ├─► Saves Remark record in Prisma DB
  │           │
  │           ├─► Triggers Upward Notification:
  │           │     - If OFFICE_HEAD posts -> Notify supervising DIRECTOR
  │           │     - If DIRECTOR posts -> Notify supervising VICE_PRESIDENT
  │           │     - If VICE_PRESIDENT posts -> Notify PRESIDENTS / ADMIN
  │           │
  │           └─► ActivityLogService.log()
  │
[3. Receiver Header Bell Alert]
  │
  └─► Receiver Frontend: Header.tsx -> fetchUnreadCount()
        └─► Displays unread badge counter + toast alert via `sonner`
```

---

## 🗄 4. Key Database Models (Prisma)

Each identity receives an RBAP and QM membership by default. The memberships
store independent roles, offices, and statuses, so an administrator can later
make one workspace account different or inactive without changing the other.
JWTs and authorization always use the selected workspace membership; the
legacy `User.role` and `User.officeId` fields are retained for RBAP
compatibility.

```prisma
model Office {
  id        String   @id @default(cuid())
  name      String   @unique
  code      String?  @unique
  status    OfficeStatus @default(ACTIVE)
  parentId  String?
  parent    Office?  @relation("OfficeHierarchy", fields: [parentId], references: [id])
  children  Office[] @relation("OfficeHierarchy")
  members   User[]
  plans     Plan[]
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String
  role         Role     @default(OFFICE_HEAD)
  status       UserStatus @default(ACTIVE)
  officeId     String?
  office       Office?  @relation(fields: [officeId], references: [id])
  passwordHash String?
  googleId     String?  @unique
  memberships  AccountMembership[]
}

enum Workspace {
  RBAP
  QM
}

model AccountMembership {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  workspace Workspace
  role      Role
  officeId  String?
  office    Office?   @relation(fields: [officeId], references: [id])
  status    UserStatus @default(ACTIVE)

  @@unique([userId, workspace])
}

model Plan {
  id            String   @id @default(cuid())
  officeId      String
  office        Office   @relation(fields: [officeId], references: [id])
  planningYear  Int
  title         String
  status        PlanStatus @default(DRAFT)
  goals         Goal[]

  @@unique([officeId, planningYear])
}
```

---

## 💻 5. Developer Onboarding Checklist

1. **Environment Verification**:
   - Ensure Node.js v20+ and PostgreSQL 16+ are installed.
   - Run `cd backend && npm install && npm run build` to verify backend build.
   - Run `cd shadcn/vite-monorepo/apps/web && npm run build` to verify frontend build.

2. **Code Style & Conventions**:
   - Backend: All controllers must remain thin (only parse request data, pass to service, return response).
   - Backend: Always use Prisma `select` clauses to avoid leaking sensitive fields like `passwordHash`.
   - Frontend: Always import shared UI components from `@workspace/ui/components/xxx`.
   - Frontend: Always wrap API mutation errors in `toast.error()`.
