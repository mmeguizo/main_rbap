# RBAP IDM — Backend API Service

Backend API for the **CHMSU Dashboard-Based Quality Management and Monitoring System (RBAP IDM)**.

Built with **NestJS v11**, **TypeScript**, **Prisma v7 (`@prisma/adapter-pg`)**, and **PostgreSQL**.

---

## ⚡ Implemented Modules

All core feature modules are fully built, tested, and integrated into `AppModule`:

1. **`auth`**: Google OAuth2 (`@chmsu.edu.ph` domain restriction), JWT access (15m) + refresh (7d) tokens, password-login, dev-login, register, and refresh flow.
2. **`users`**: User management, status activation/deactivation, office assignment, role updates, and Google account linking.
3. **`offices`**: Self-referencing office hierarchy tree (`parentId`), member management, and centralized scope/visibility evaluation.
4. **`plans`**: Annual RBAP plans (unique per `(officeId, planningYear)`), submit/approve lifecycle, budget requirement & allocation aggregation, PDF export, and Excel workbook import.
5. **`goals`**: Institutional goals nested under plans with budget columns, completion progress tracking, and top-level browsing.
6. **`objectives`**: Actionable objectives nested under goals with target dates, completion status, and top-level browsing.
7. **`remarks`**: Goal feedback & commenting system with hierarchy-based notification triggering and activity logging.
8. **`notifications`**: In-app notifications with read/unread tracking, smart navigation parameters, and user inbox management.
9. **`activity-log`**: Administrative audit trail logging system CRUD events.

---

## 🛠 Tech Stack

- **Framework**: NestJS v11
- **Language**: TypeScript (ES2023 / Target ES2023)
- **Database & ORM**: PostgreSQL + Prisma v7 via `@prisma/adapter-pg`
- **Authentication**: Passport JWT + Google OAuth2 Strategy
- **Validation**: Global `ValidationPipe` with `whitelist: true`, `class-validator`, and `class-transformer`
- **API Documentation**: Swagger UI at `/api/docs` (behind Basic Auth)
- **Testing**: Jest unit tests + Jest E2E tests + Playwright API audit tests

---

## 📡 API Endpoint Reference

Global Prefix: `/api/v1`

### Health Check
- `GET /healthz` — System readiness and database connectivity health probe

### Authentication (`/api/v1/auth`)
- `GET /auth/me` — Return authenticated user profile (excludes sensitive hashes)
- `POST /auth/google` — Initiate Google OAuth2 login flow
- `GET /auth/google/callback` — Google OAuth2 redirect callback
- `POST /auth/password-login` — Standard password authentication
- `POST /auth/set-password` — Create password for existing Google account
- `POST /auth/refresh` — Issue new access token using valid refresh token
- `POST /auth/register` — User registration with domain validation
- `POST /auth/dev-login` — Local development auto-login (non-production only)

### User Management (`/api/v1/users`)
- `GET /users` — Paginated user listing (ADMIN / PRESIDENTS)
- `GET /users/:id` — Detailed user information
- `PATCH /users/:id/status` — Activate or deactivate user (`ACTIVE` / `INACTIVE`)
- `PATCH /users/:id/office` — Assign user to office
- `PATCH /users/:id/role` — Update user role (ADMIN only)
- `DELETE /users/:id` — Soft-delete or remove user (ADMIN only)

### Office Hierarchy (`/api/v1/offices`)
- `GET /offices` — Paginated list of university offices
- `GET /offices/tree` — Visual org-chart hierarchy tree
- `GET /offices/accessible` — Return list of office IDs accessible to current user
- `POST /offices` — Create new office (ADMIN only)
- `PATCH /offices/:id` — Update office details, head, or parent office (ADMIN only)
- `DELETE /offices/:id` — Remove office (ADMIN only)

### Plans (`/api/v1/plans`)
- `POST /plans` — Create plan for user's office (`DRAFT` state)
- `GET /plans` — List plans filtered by user's office hierarchy scope
- `GET /plans/summary` — Aggregate plan KPIs and budget metrics for dashboard
- `GET /plans/pending-approvals` — List `SUBMITTED` plans from subordinate offices
- `GET /plans/:id` — Plan details with budget totals
- `PATCH /plans/:id` — Update plan title or description
- `DELETE /plans/:id` — Delete plan (`DRAFT` state only)
- `PATCH /plans/:id/submit` — Submit plan upward in hierarchy
- `PATCH /plans/:id/approve` — Approve plan (`PRESIDENTS` / `ADMIN` only)
- `GET /plans/:id/export/pdf` — Generate printable PDF report
- `POST /plans/import/excel` — Parse and import plan from CHMSU Excel workbook
- `GET /plans/export/excel` — Export office plans as Excel spreadsheet

### Goals (`/api/v1/goals` & `/api/v1/plans/:planId/goals`)
- `POST /plans/:planId/goals` — Create goal under plan
- `GET /plans/:planId/goals` — List goals for plan
- `GET /plans/:planId/goals/:id` — Get goal details
- `PATCH /plans/:planId/goals/:id` — Update goal title, description, or budget
- `DELETE /plans/:planId/goals/:id` — Delete goal
- `GET /goals` — Top-level paginated goals browse
- `GET /goals/:id` — Top-level goal lookup

### Objectives (`/api/v1/objectives` & `/api/v1/plans/:planId/goals/:goalId/objectives`)
- `POST /plans/:planId/goals/:goalId/objectives` — Create objective under goal
- `GET /plans/:planId/goals/:goalId/objectives` — List objectives under goal
- `PATCH /plans/:planId/goals/:goalId/objectives/:id` — Update objective status/target date
- `DELETE /plans/:planId/goals/:goalId/objectives/:id` — Delete objective
- `GET /objectives` — Top-level paginated objectives browse

### Remarks (`/api/v1/remarks`)
- `POST /goals/:goalId/remarks` — Post remark on goal (triggers hierarchical notification)
- `POST /goals/:goalId/objectives/:objectiveId/remarks` — Post remark on objective
- `GET /goals/:goalId/remarks` — Fetch remark comment thread for goal

### Notifications (`/api/v1/notifications`)
- `GET /notifications` — Paginated notification inbox for current user
- `GET /notifications/unread-count` — Unread notification counter for header bell
- `PATCH /notifications/read-all` — Mark all user notifications as read
- `PATCH /notifications/:id/read` — Mark specific notification as read

### Activity Audit Log (`/api/v1/activity-log`)
- `GET /activity-log` — Audit log listing of CRUD operations (ADMIN only)

---

## 🏛 Hierarchical Access Rules (`offices.service.ts`)

Visibility scope is computed dynamically based on the organizational hierarchy tree:

```text
Office (parentId)
  ├── OFFICE_HEAD (Level 0)   -> Access to own office only
  ├── DIRECTORS (Level 1)     -> Access to own office + direct child offices
  ├── VICE_PRESIDENTS (Lvl 2) -> Access to own office + full subordinate subtree
  ├── PRESIDENTS (Level 3)    -> Read & approval access across all active offices
  └── ADMIN (Level 4)         -> Unrestricted system-wide access
```

---

## 🚀 Local Development Setup

### 1. Environment Configuration
Create a `.env` file in `backend/`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rbap_idm?schema=public"
PORT=3000
HOST="localhost"
FRONTEND_URL="http://localhost:5173"

JWT_SECRET="your-access-token-secret"
JWT_REFRESH_SECRET="your-refresh-token-secret"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/api/v1/auth/google/callback"

SWAGGER_ENABLED=true
SWAGGER_USER="admin"
SWAGGER_PASSWORD="password"
```

### 2. Database Migrations & Seeding
```bash
# Apply migrations
npx prisma migrate dev

# Seed database with office hierarchy and admin user
npm run seed
```

### 3. Running the API
```bash
# Watch mode (development)
npm run start:dev

# Production build & start
npm run build
npm run start:prod
```

---

## 🧪 Testing & Code Quality

```bash
# Unit tests
npm run test

# E2E integration tests
npm run test:e2e

# ESLint check & auto-fix
npm run lint
```

