# RBAP-IDM Backend — Project Guidelines

## Project Overview

This is the backend for the Institutional PME Dashboard (RBAP & QOAP) system. It manages Results-Based Action Plans and Quality Objectives Action Plans for the institution's Planning, Monitoring, and Evaluation office.

## Stack

- **Framework**: NestJS v11
- **Database**: PostgreSQL (local, port 5432, database: `rbap_idm`)
- **ORM**: Prisma v7 (client output: `generated/prisma/`)
- **API**: REST, versioned at `/api/v1/`
- **Auth**: JWT + Passport
- **Validation**: `class-validator` + `class-transformer`

## Architecture Rules

### Module Structure

Every feature follows this exact pattern:

```
src/
└── <feature>/
    ├── <feature>.module.ts
    ├── <feature>.controller.ts
    ├── <feature>.service.ts
    └── dto/
        ├── create-<feature>.dto.ts
        └── update-<feature>.dto.ts
```

### Prisma Import Path

The Prisma client in this project is generated to a non-standard path. Always import from:

```ts
import { PrismaClient } from '../../generated/prisma';
```

NOT from `@prisma/client`.

### PrismaService Location

`src/prisma/prisma.service.ts` — inject this into any service that needs DB access.

### Response Shape

All REST responses must follow this shape:

```ts
{ data: T | null, message: string, statusCode: number }
```

## Domain Hierarchy

The core data hierarchy for RBAP/QOAP is:

```
StrategicGoal → Objective → ActionPlan → KPI → Department
```

Every data model should trace back up to this hierarchy.

## Security Requirements

- All non-public routes must use the `JwtAuthGuard`.
- Role-protected routes must use the `RolesGuard` with the `@Roles()` decorator.
- User roles: `ADMIN` (PME Office), `DEAN`, `DEPARTMENT_HEAD`, `VIEWER`.
- Never expose password fields in any response — always use `select` to exclude them.
- Never log sensitive data (passwords, tokens).

## Development Conventions

- Run `npx prisma migrate dev --name <description>` for every schema change.
- Run `npx prisma generate` after any schema change before running the app.
- Use `npm run start:dev` for development (watch mode).
- All environment variables live in `.env` — never hardcode connection strings or secrets.
