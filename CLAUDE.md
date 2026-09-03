# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Identity

RBAP IDM (Institutional Dashboard Monitoring) — a full-stack web application for CHMSU (Carlos Hilado Memorial State University) to manage Results-Based Action Plans. Offices create annual plans containing goals and objectives, track progress and budgets, submit for approval, and operate under a hierarchical role-based access model.

## Repo Layout

```
backend/                    # NestJS v11 + Prisma v7 + PostgreSQL (main API, port 3000)
shadcn/vite-monorepo/       # Turborepo — THE active frontend (port 5173)
  apps/web/                 # React 19 + Vite + Tailwind v4 + shadcn/ui
  packages/ui/              # Shared shadcn/ui component library
frontend/                   # ⚠️ LEGACY — Angular v20 + CoreUI. DO NOT WORK ON THIS.
frontend_react/             # ⚠️ LEGACY — old stub. DO NOT WORK ON THIS.
```

All frontend work goes in `shadcn/vite-monorepo/apps/web/`. The `frontend/` and `frontend_react/` directories are old, frozen code — never modify them.

## Commands

### Backend (`backend/`)

| Command | What it does |
|---|---|
| `npm run start:dev` | NestJS dev server with hot reload (port 3000) |
| `npm run build` | `nest build` |
| `npm run lint` | ESLint flat config + `--fix` |
| `npm run format` | Prettier write |
| `npm run test` | Jest unit tests |
| `npm run test:e2e` | Jest E2E tests (`test/jest-e2e.json`) |
| `npm run test:api:audit` | Playwright API tests |
| `npm run seed` | `ts-node prisma/seed.ts` (seeds office tree) |
| `npx prisma migrate dev --name <name>` | Create and apply a migration |
| `npx prisma migrate dev` | Apply pending migrations |
| `npx prisma generate` | Regenerate Prisma client |
| `npx prisma studio` | GUI database browser |

### React Frontend (`shadcn/vite-monorepo/`)

| Command | What it does |
|---|---|
| `npm run dev` | `turbo dev` — Vite on :5173, proxies `/api` to :3000 |
| `npm run build` | `turbo build` (zero TS errors required) |
| `npm run lint` | `turbo lint` |
| `npm run typecheck` | `turbo typecheck` |
| `npm run format` | Prettier with Tailwind plugin |

## Architecture

### Backend Module Pattern

Every feature module follows this structure:

```
src/<name>/
  <name>.module.ts
  <name>.controller.ts       # Thin: extracts request data, calls service, returns result
  <name>.service.ts          # All business logic + Prisma queries live here
  dto/
    create-<name>.dto.ts
    update-<name>.dto.ts
    query-<name>.dto.ts      # If paginated/filterable
```

### Currently Built Modules (all wired into `AppModule`)

| Module | Purpose |
|---|---|
| `auth` | JWT (15m access + 7d refresh), Google OAuth2 (`@chmsu.edu.ph` only), dev-login, password-login, register |
| `users` | User CRUD, status/office/role management, Google auto-linking |
| `offices` | Self-referencing office tree (parentId), hierarchy visibility logic reused by all other modules |
| `plans` | Annual RBAP plans with submit/approve workflow, budget aggregation via Prisma `groupBy`, unique per `(officeId, planningYear)` |
| `goals` | Goals nested under plans (`/plans/:planId/goals`) + top-level browse (`/goals`) |
| `objectives` | Objectives nested under goals + top-level browse (`/objectives`) |
| `remarks` | Comments on goals, hierarchy-based notification triggers, activity logging |
| `notifications` | In-app notification system with read/unread, filtering, bell dropdown |
| `activity-log` | Audit trail for CRUD operations across the system |

### Data Model Hierarchy

```
Office (tree via parentId)
  └── User (role, officeId)
        └── Plan (officeId, planningYear) — unique per office per year
              └── Goal (planId, officeId)
                    └── Objective (goalId)
```

### Role Hierarchy & Visibility (centralized in `offices.service.ts`)

| Role | Level | Can see |
|---|---|---|
| `OFFICE_HEAD` | 0 | Own office only |
| `DIRECTORS` | 1 | Own office + direct children |
| `VICE_PRESIDENTS` | 2 | Own office + full subtree |
| `PRESIDENTS` | 3 | All active offices |
| `ADMIN` | 4 | All active offices (full system access) |

The offices service exposes `getAccessibleOfficeIds()`, `canAccessOffice()`, `getSubordinateOfficeIds()`, and `getOfficeSubtreeIds()` — all other modules call these for scope filtering.

### API Conventions

- Global prefix: `/api/v1`
- Swagger docs: `/api/docs` (behind basic auth, enabled only when `SWAGGER_ENABLED=true`)
- All controllers: `@UseGuards(JwtAuthGuard, RolesGuard)` at class level + `@Roles(...)` per method
- All DTOs: `class-validator` decorators + `@ApiProperty()` for Swagger
- Global `ValidationPipe` with `whitelist: true` — unknown fields are stripped

### Response Conventions

- List endpoints return `{ data: T[], meta: { total, take, skip, returned } }`
- Single-item endpoints return the object directly
- Paginated queries use `$transaction([findMany, count])` for atomic fetch+count

## Key Coding Rules

### Prisma
- **Always use `select`** — never return raw rows. Prevents leaking fields like `passwordHash` and `googleId` to clients.
- Use `$transaction` for any operation requiring multiple writes.
- Catch Prisma error `P2025` (record not found) on update/delete and convert to `NotFoundException`.

### Error Handling
- `NotFoundException` — resource not found
- `ForbiddenException` — user lacks permission for that resource
- `BadRequestException` — invalid input or missing required fields
- `UnauthorizedException` — unauthenticated or token invalid/expired

### Validation
- Use `@IsOptional()` for optional fields (not empty strings or null checks).
- Controllers extract request data and delegate — no business logic in controllers.

## Trace Requests (Required)

When asked to trace a flow from frontend to backend or vice versa, always provide:

1. A numbered step-by-step path from start event to final result
2. The exact file and function at each hop
3. Clear handoff points (component → service → HTTP → controller → service → Prisma → response → state update)
4. An ASCII-style flow map when it helps
5. Short code snippets for redirect/request/navigation lines

The user is a visual learner. Prefer execution maps, arrows, and concrete file-to-file handoffs over abstract explanations.

## Environment Variables (backend/.env)

```
DATABASE_URL=postgresql://postgres:toor@localhost:5432/rbap
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
PORT=3000
HOST=localhost
```

## React Frontend Key Files (`shadcn/vite-monorepo/apps/web/src/`)

| File | Purpose |
|---|---|
| `lib/api.ts` | All API endpoint definitions |
| `lib/roles.ts` | Role helpers: `ROLE_HIERARCHY`, `hasMinRole`, `canWriteOffice` |
| `contexts/AuthContext.tsx` | Auth state with user `role` and `office.id` |
| `components/sidebar.tsx` | Role-filtered nav items |
| `components/dashboard-layout.tsx` | Responsive layout with collapsible sidebar |
| `components/plan-detail-modal.tsx` | Plan CRUD + expandable goal/objective hierarchy |

Import alias: `@` → `src/`. Shared components: `@workspace/ui/components/xxx`.

## Known Issues

- `GET /user/user-id` throws 500 if `userId` query param is missing (controller passes `undefined` to Prisma)
- Build chunk size warning (~965 kB) from recharts in the React app — future optimization candidate
