# AGENTS.md

High-signal facts for OpenCode sessions. See `CLAUDE.md` for full reference — this file adds what an agent would likely miss.

## Git Structure — Submodules

`backend/` and `shadcn/vite-monorepo/` are **git submodules** pointing to separate repos (`rbap-backend` and `rbap-frontend`). Changes in those directories go to different repos. The umbrella repo has its own `.gitmodules` and a GitHub Actions auto-merge workflow (`auto-merge.yml`) that merges any branch push to `main` automatically.

## Critical Directories

- `backend/` — NestJS v11 + Prisma v7, **CommonJS** (`"sourceType": "commonjs"` in eslint.config.mjs)
- `shadcn/vite-monorepo/apps/web/` — React 19 + Vite 8, **the only active frontend**
- `frontend/` and `frontend_react/` — **LEGACY, never touch**

## Existing Instruction Files (check these first)

| File | What it has |
|---|---|
| `CLAUDE.md` (root) | Main reference — project, commands, architecture, coding rules |
| `backend/COPILOT_INSTRUCTIONS.md` | Module pattern, DTO/controller/service templates, Prisma rules |
| `PROJECT_STATUS.md` | What's built, P0/P1 status, known issues |
| `TASKS_NEXT.md` | Task queue for P2/P3 with verification criteria |

## Frontend Stack Details (CLAUDE.md doesn't cover all)

- **Auth**: JWT with axios interceptor auto-refresh on 401; tokens in `localStorage` (`access_token`, `refresh_token`); `withCredentials: true`
- **Toasts**: `sonner` — always use `toast.error()` in catch blocks (zero `.catch(console.error)` remaining)
- **Forms**: `react-hook-form` + `zod` — all modals and LoginPage already migrated
- **Route guards**: `<RoleGuard minRole={...}>` component exists in `components/role-guard.tsx`
- **Imports**: `@` → `src/` (vite alias); shared UI: `@workspace/ui/components/xxx`
- **Dev server**: Vite on `:5173`, proxies `/api` to `:3000`
- **Build**: `npm run build` = `tsc -b && vite build` — **zero TS errors required**
- **Charts**: `recharts` (~370 kB), contributes to chunk size warning (~965 kB total)
- **Shared UI**: `@workspace/ui` in `packages/ui/` — exports components via `./components/*` (check `packages/ui/package.json` `exports` before importing)

## Backend Gotchas

- **ESLint**: flat config, `no-explicit-any: off`, `no-floating-promises: warn` — don't be surprised
- **Prisma**: `@prisma/adapter-pg` (PrismaPg driver) — not the default. All Prisma instantiation goes through `PrismaService` which constructs the adapter from `DATABASE_URL`.
- **Seed**: `npm run seed` uses `ts-node prisma/seed.ts`, upserts hardcoded office tree from `Board of Regents`
- **TypeScript**: `emitDecoratorMetadata: true`, `experimentalDecorators: true`, `target: ES2023`, `outDir: ./dist`, `module: nodenext`
- **Auth flow**: Google OAuth restricted to `@chmsu.edu.ph`; dev login at `POST /api/v1/auth/dev-login`; auto-links Google to existing account by email
- **Response shape inconsistency**: offices/goals/objectives use `{ data, meta: { total, take, skip, returned } }` but notifications/activity-log use `{ data, total, take, skip }`. Match the pattern of the module you're editing.
- **Global prefix**: all routes are under `/api/v1`
- **Swagger**: `/api/docs` (requires `SWAGGER_ENABLED=true` + basic auth)

## Commands Quick Reference

### Backend (`backend/`)
```bash
npm run start:dev    # NestJS hot reload (port 3000)
npm run build        # nest build
npm run lint         # eslint --fix (flat config)
npm run test         # Jest unit tests
npm run test:e2e     # Jest E2E (test/jest-e2e.json)
npm run test:api:audit # Playwright API tests (test/playwright/)
npm run seed         # ts-node prisma/seed.ts
npx prisma migrate dev --name <name>  # Create + apply migration
npx prisma generate  # Regenerate client
npx prisma studio    # GUI database browser
```

### Frontend (`shadcn/vite-monorepo/`)
```bash
npm run dev          # turbo dev (Vite :5173)
npm run build        # turbo build (zero TS errors required)
npm run lint         # turbo lint
npm run typecheck    # turbo typecheck
npm run format       # Prettier + Tailwind plugin
```

## Writing New Modules (backend)

Every module follows: `module.ts` → `controller.ts` → `service.ts` → `dto/` (create, update, query). Controllers extract request data only — no logic. Services hold all Prisma + business logic. Always use `select` — never raw rows. List endpoints return `{ data, meta: { total, take, skip, returned } }`.

## Access Scope (centralized in `offices.service.ts`)

| Role | Can see |
|---|---|
| `OFFICE_HEAD` (0) | Own office only |
| `DIRECTORS` (1) | Own + direct children |
| `VICE_PRESIDENTS` (2) | Own + full subtree |
| `PRESIDENTS` (3) | All active offices |
| `ADMIN` (4) | All active offices |

Methods: `getAccessibleOfficeIds()`, `canAccessOffice()`, `getSubordinateOfficeIds()`, `getOfficeSubtreeIds()`.
