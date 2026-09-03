# RBAP IDM – Backend Project Instructions

## Project Identity

**Full Name:** CHMSU Dashboard-Based Quality Management and Monitoring System  
**Short Name:** RBAP IDM (Institutional Dashboard Monitoring)  
**Institution:** Carlos Hilado Memorial State University (CHMSU)  
**Scope:** Backend API only. Staff and admin roles only. Faculty users are out of scope.

---

## Tech Stack

| Layer         | Technology                                                                       |
| ------------- | -------------------------------------------------------------------------------- |
| Framework     | NestJS v11                                                                       |
| Language      | TypeScript                                                                       |
| ORM           | Prisma v7 with `@prisma/adapter-pg`                                              |
| Database      | PostgreSQL                                                                       |
| Auth          | JWT (access + refresh tokens) + Google OAuth2 (`@chmsu.edu.ph` domain only)      |
| Validation    | `class-validator` + `class-transformer`, `ValidationPipe` with `whitelist: true` |
| API Docs      | Swagger (`@nestjs/swagger`), behind basicAuth, at `/api/docs`                    |
| Testing       | Jest + `ts-jest`                                                                 |
| Global Prefix | `/api/v1`                                                                        |

---

## Trace Requests (Required)

When the user asks to trace a flow from **frontend to backend**, **backend to frontend**, or across both, explain it as a visual execution trail, not a short summary.

Always include:

1. A numbered step-by-step path from the starting event to the final result
2. The exact file and function at each hop
3. Clear handoff points, such as:
   - component → service
   - frontend → HTTP request
   - route → controller → service → Prisma
   - backend response → frontend state update
   - browser redirect → Angular route → router navigation
4. A small ASCII-style flow map when it helps, for example:

```txt
Login button click
  -> LoginComponent.loginWithGoogle()
  -> AuthService.loginWithGoogle()
  -> GET /api/v1/auth/google
  -> AuthController.googleCallback()
  -> /#/auth/callback
  -> AuthCallbackComponent.ngOnInit()
  -> router.navigate(['/dashboard'])
```

5. Short code snippets for the exact redirect, request, or navigation line when that makes the flow easier to follow

The user is a visual learner. Prefer execution maps, arrows, short code excerpts, and concrete file-to-file handoffs over abstract explanations.

---

## User Roles (Staff/Admin Only)

Roles are defined in the `Role` enum in `prisma/schema.prisma`. Faculty is **not** included.

| Role              | Access Level                                                                        |
| ----------------- | ----------------------------------------------------------------------------------- |
| `ADMIN`           | Full system access: manage users, offices, goals, view all data                     |
| `PRESIDENTS`      | Full view and oversight of all goals, objectives, remarks, and notifications        |
| `VICE_PRESIDENTS` | Monitor goals/objectives of Directors under their supervision; post remarks         |
| `DIRECTORS`       | View and respond to remarks from assigned Office Heads; escalate to VP              |
| `OFFICE_HEAD`     | Create goals and objectives for own office; post remarks; receive Director feedback |

### Hierarchical Visibility Rule

Each role can **only see data from offices directly assigned below them** in the org tree:

- A Director can only view Office Heads assigned to their office — not another Director's Office Heads.
- A Vice President can only view Directors under their office.
- Admin and Presidents have unrestricted read access across all offices.

---

## Office Hierarchy

Offices form a **self-referencing tree** via `parentId`. The `Office` model in Prisma stores:

- `id` – cuid
- `name` – unique
- `parentId` – nullable FK to parent office
- `headId` – nullable FK to the User who is the head of this office
- `members` – User[] relation
- `status` – `OfficeStatus` enum (`ACTIVE` / `INACTIVE`)

When assigning roles, users are linked to an office. Their visibility scope is derived from the office tree.

---

## Authentication Rules

- Login is via **Google OAuth2** restricted to `@chmsu.edu.ph` email domain only.
- On login, both an **access token** (15 minutes) and a **refresh token** (7 days) are issued.
- Tokens are signed with separate secrets: `JWT_SECRET` (access) and `JWT_REFRESH_SECRET` (refresh).
- A `POST /api/v1/auth/refresh` endpoint accepts a valid refresh token and returns new tokens.
- Token revocation is enforced at the JWT validation stage: if the user's `status` is `INACTIVE`, all requests are rejected with `403 Forbidden`.
- A `POST /api/v1/auth/dev-login` endpoint exists for local development only (disabled in production).

---

## Current Module Status

### ✅ Completed Modules

#### `auth` module (`src/auth/`)

- Google OAuth callback → issues JWT access + refresh tokens
- `POST /auth/refresh` → validates refresh token → returns new token pair
- `GET /auth/me` → returns authenticated user profile
- JWT strategy validates user status on every request (INACTIVE → 403)

#### `users` module (`src/users/`)

- `GET /users/:id` – get user info by ID (admin)
- `PATCH /users/:id/status` – activate or deactivate a user (admin)
- `PATCH /users/:id/office` – assign a user to an office (admin)
- `PATCH /users/:id/role` – assign a role to a user (admin)
- `findById()` – throws `UnauthorizedException` if not found, `ForbiddenException` if `INACTIVE`
- `checkUserById()` – neutral existence check for admin flows (does not throw for INACTIVE)

#### `offices` module (`src/offices/`)

- `GET /offices` – paginated list of all offices
- `POST /offices/add-office` – create a new office (admin)
- `PATCH /offices/update-office` – update office details (admin)

---

### 🔲 Remaining Modules to Build

The following modules are required to complete the system. Each must follow the NestJS module pattern: `module → controller → service → DTO → Prisma schema`.

---

#### `goals` module

**Purpose:** Office Heads create and manage institutional goal implementations. Higher roles view and track progress.

**Prisma Model Fields (to be designed):**

- `id` – cuid
- `title` – string
- `description` – string (optional)
- `officeId` – FK to Office
- `createdById` – FK to User
- `status` – enum: `NOT_STARTED | IN_PROGRESS | COMPLETED`
- `targetDate` – DateTime (optional)
- `createdAt`, `updatedAt`

**Endpoints:**
| Method | Route | Role |
|---|---|---|
| `POST` | `/goals` | `OFFICE_HEAD` |
| `GET` | `/goals` | All roles (filtered by hierarchy) |
| `GET` | `/goals/:id` | All roles (if in scope) |
| `PATCH` | `/goals/:id` | `OFFICE_HEAD` (own goals only), `ADMIN` |
| `DELETE` | `/goals/:id` | `OFFICE_HEAD` (own goals only), `ADMIN` |

**Business Rules:**

- An Office Head can only create goals for their own assigned office.
- Directors can read goals from Office Heads under their office.
- Vice Presidents can read goals from Directors under their office.
- Admin and Presidents can read all goals.

---

#### `objectives` module

**Purpose:** Specific, actionable tasks created under a goal by the Office Head.

**Prisma Model Fields (to be designed):**

- `id` – cuid
- `goalId` – FK to Goal
- `title` – string
- `targetDate` – DateTime (optional)
- `status` – enum: `NOT_STARTED | IN_PROGRESS | COMPLETED`
- `createdById` – FK to User
- `createdAt`, `updatedAt`

**Endpoints:**
| Method | Route | Role |
|---|---|---|
| `POST` | `/goals/:goalId/objectives` | `OFFICE_HEAD` |
| `GET` | `/goals/:goalId/objectives` | All roles (if goal is in scope) |
| `PATCH` | `/goals/:goalId/objectives/:id` | `OFFICE_HEAD` (own only), `ADMIN` |
| `DELETE` | `/goals/:goalId/objectives/:id` | `OFFICE_HEAD` (own only), `ADMIN` |

**Business Rules:**

- Objectives can only be deleted — not edited — per system design.
- Goal status should be auto-updated based on objective completion states.

---

#### `remarks` module

**Purpose:** Users at all roles can post comments on goals or objectives. Triggers notifications upward in the hierarchy.

**Prisma Model Fields (to be designed):**

- `id` – cuid
- `content` – string
- `authorId` – FK to User
- `goalId` – FK to Goal (nullable if attached to objective)
- `objectiveId` – FK to Objective (nullable)
- `createdAt`

**Endpoints:**
| Method | Route | Role |
|---|---|---|
| `POST` | `/goals/:goalId/remarks` | All roles (if in hierarchy scope) |
| `POST` | `/goals/:goalId/objectives/:objectiveId/remarks` | All roles (if in scope) |
| `GET` | `/goals/:goalId/remarks` | All roles (if in scope) |

**Business Rules:**

- When a remark is posted, a notification must be created for the **next higher role** in the hierarchy.
  - Office Head posts → Director gets notified
  - Director posts → Vice President gets notified
  - Vice President posts → Admin/President gets notified

---

#### `notifications` module

**Purpose:** Real-time alerts triggered when remarks are added or objectives are updated.

**Prisma Model Fields (to be designed):**

- `id` – cuid
- `recipientId` – FK to User
- `message` – string
- `isRead` – boolean (default: false)
- `relatedGoalId` – FK to Goal (optional)
- `relatedRemarkId` – FK to Remark (optional)
- `createdAt`

**Endpoints:**
| Method | Route | Role |
|---|---|---|
| `GET` | `/notifications` | All roles (own notifications only) |
| `PATCH` | `/notifications/:id/read` | All roles (own only) |
| `PATCH` | `/notifications/read-all` | All roles (own only) |

**Business Rules:**

- Admin and Presidents **cannot** mark others' notifications as read.
- Notifications are created by the system (via the remarks service), not directly by users.

---

## Coding Conventions

### Module Structure

Every module follows this file structure:

```
src/<module>/
  <module>.module.ts
  <module>.controller.ts
  <module>.service.ts
  dto/
    create-<module>.dto.ts
    update-<module>.dto.ts
    pagination.dto.ts (if paginated)
```

### Guards

All controller classes use `@UseGuards(JwtAuthGuard, RolesGuard)` at the class level.  
Methods use `@Roles(Role.ADMIN, Role.OFFICE_HEAD, ...)` from `src/auth/roles.decorator.ts`.

### Pagination

All list endpoints that return multiple records must support pagination:

```ts
// Example query params
GET /goals?page=1&limit=10
```

Use the `PaginationDto` pattern from `src/offices/dto/pagination.dto.ts` as reference.

### Error Handling

- `NotFoundException` – resource not found
- `ForbiddenException` – user lacks permission for that resource
- `BadRequestException` – invalid input or missing required fields
- `UnauthorizedException` – unauthenticated or token invalid/expired

### DTOs

- All DTOs use `class-validator` decorators
- All DTOs are registered with Swagger `@ApiProperty()`
- Use `@IsOptional()` for optional fields, not empty strings or null checks

### Prisma

- Use `$transaction` for operations that require multiple writes
- Catch Prisma error code `P2025` (record not found) on update/delete and convert to `NotFoundException`
- Use `select` in Prisma queries to avoid returning sensitive fields (e.g., `googleId`)

---

## Environment Variables Required

```env
DATABASE_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
SWAGGER_USER=
SWAGGER_PASSWORD=
PORT=3000
HOST=localhost
```

---

## Development Notes

- Run migrations: `npx prisma migrate dev --name <description>`
- Seed database: `npx ts-node prisma/seed.ts`
- Start server: `npm run start:dev`
- Run tests: `npm run test`
- Expose local server via ngrok: `ngrok http --url=unduly-enjoyed-parrot.ngrok-free.app 3000`
- Manual token access (dev): `https://10.100.168.9:3000/api/v1/auth/google/callback`
- Swagger docs: `/api/docs` (requires basicAuth credentials from env)
