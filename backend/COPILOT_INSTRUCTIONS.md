# RBAP Backend — Copilot / Agent Instructions

> **Agent Mode Rule:** If you are in agent mode, skip all tutorials, explanations, and mentor-style commentary.
> Just implement. Use clean, readable code with comments everywhere.
> Do not ask clarifying questions unless the requirement is truly ambiguous.
>
> **Exception for Trace Requests:** If the user asks to trace a request from frontend to backend or backend to frontend, explain the full path visually.
> Use numbered steps, arrow-style request flow, exact controller/service/DTO file references, and short code excerpts for the real handoff lines.

---

## Trace / Visual Flow Rule

When the user asks to trace a request or follow a backend flow, explain it as an execution path instead of a summary.

Always include:

1. Where the request starts
2. Which controller method receives it
3. Which service method does the business logic
4. Which Prisma query or downstream call runs
5. What response shape is returned
6. Where that response is consumed on the frontend if the question crosses both layers

Preferred format:

```txt
Frontend action
  -> HTTP request
  -> Nest controller
  -> service method
  -> Prisma query
  -> shaped response
  -> frontend service/state
  -> UI render
```

If the trace involves auth, redirects, guards, interceptors, or router navigation, call out those handoff points explicitly.

---

## Project Identity

**App:** RBAP — CHMSU Dashboard-Based Quality Management and Monitoring System (Backend API)  
**Framework:** NestJS v11  
**Language:** TypeScript (strict mode — no `any`)  
**ORM:** Prisma v7 with `@prisma/adapter-pg`  
**Database:** PostgreSQL  
**Auth:** JWT (access 15m + refresh 7d) + Google OAuth2 (`@chmsu.edu.ph` only)  
**Validation:** `class-validator` + `class-transformer`, global `ValidationPipe` with `whitelist: true`  
**API Docs:** Swagger at `/api/docs` (behind basicAuth)  
**Global Prefix:** `/api/v1`

---

## Core Rule: Backend Does the Work

> All logic, filtering, aggregation, role-based visibility, and calculations happen **here**, on the backend.
> The frontend only displays what the backend returns.
> Never return raw database rows — always shape the response before sending it.

**Bad (never do this):**

```ts
// ❌ Returning raw DB rows — exposes sensitive fields
return this.prisma.user.findMany();
```

**Good (always shape the response):**

```ts
// ✅ Select only the fields the frontend needs
return this.prisma.user.findMany({
  select: { id: true, email: true, name: true, role: true, status: true },
});
```

---

## Module Folder Structure

Every feature module follows this exact layout. Create all these files when building a new module.

```
src/<module>/
├── <module>.module.ts           ← registers the module, imports, exports
├── <module>.controller.ts       ← HTTP route handlers — maps requests to service calls
├── <module>.service.ts          ← all business logic and Prisma queries
├── dto/
│   ├── create-<module>.dto.ts   ← shape of the POST body (with class-validator decorators)
│   ├── update-<module>.dto.ts   ← shape of the PATCH body (all fields optional)
│   └── query-<module>.dto.ts    ← query params for GET list (pagination, filters)
└── types/                       ← TypeScript interfaces used inside this module
    └── <module>.types.ts
```

---

## Controller Pattern

Controllers **only** do three things:

1. Extract data from the request (body, params, query, user)
2. Call the service
3. Return the result

No logic in controllers. No Prisma calls in controllers.

```ts
// src/goals/goals.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { QueryGoalsDto } from './dto/query-goals.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@ApiTags('Goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard) // ← applies to ALL routes in this controller
@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  /** Create a new goal — only OFFICE_HEAD can do this */
  @Post()
  @Roles(Role.OFFICE_HEAD, Role.ADMIN)
  @ApiOperation({ summary: 'Create a new goal for your office' })
  create(
    @Req() req: Request & { user: AuthenticatedUser },
    @Body() dto: CreateGoalDto,
  ) {
    // pass the requesting user so the service can enforce office ownership
    return this.goalsService.create(req.user, dto);
  }

  /** Get all goals visible to the requesting user (filtered by hierarchy) */
  @Get()
  @Roles(
    Role.ADMIN,
    Role.PRESIDENTS,
    Role.VICE_PRESIDENTS,
    Role.DIRECTORS,
    Role.OFFICE_HEAD,
  )
  @ApiOperation({ summary: 'Get all goals visible to your role' })
  findAll(
    @Req() req: Request & { user: AuthenticatedUser },
    @Query() query: QueryGoalsDto,
  ) {
    return this.goalsService.findAll(req.user, query);
  }
}
```

---

## Service Pattern

Services contain all business logic and all Prisma calls.  
Every method must have a comment explaining what it does.

```ts
// src/goals/goals.service.ts

import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { QueryGoalsDto } from './dto/query-goals.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new goal.
   * Only the Office Head of the target office can create a goal for it.
   */
  async create(user: AuthenticatedUser, dto: CreateGoalDto) {
    // ensure the user is creating a goal for their own office only
    if (user.officeId !== dto.officeId) {
      throw new ForbiddenException(
        'You can only create goals for your own office.',
      );
    }

    return this.prisma.goal.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        officeId: dto.officeId,
        createdById: user.id,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
      },
      // only return the fields the frontend needs — never return the whole row
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        targetDate: true,
        createdAt: true,
      },
    });
  }

  /**
   * Returns all goals the requesting user is allowed to see.
   * Filtering is based on the user's role and their position in the office hierarchy.
   * Supports pagination via page and limit query params.
   */
  async findAll(user: AuthenticatedUser, query: QueryGoalsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    // build the Prisma where clause based on role — hierarchy logic lives here
    const where = this.buildGoalVisibilityFilter(user);

    // run both queries in parallel: get the items and the total count
    const [data, total] = await this.prisma.$transaction([
      this.prisma.goal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          targetDate: true,
          createdAt: true,
        },
      }),
      this.prisma.goal.count({ where }),
    ]);

    // return a consistent paginated shape — frontend just displays this
    return { data, total, page, limit };
  }

  /**
   * Builds a Prisma `where` filter based on the user's role.
   * - ADMIN / PRESIDENTS → see all goals
   * - VICE_PRESIDENTS → see goals from offices under their directors
   * - DIRECTORS → see goals from office heads under their office
   * - OFFICE_HEAD → see only their own office's goals
   */
  private buildGoalVisibilityFilter(user: AuthenticatedUser) {
    if (user.role === 'ADMIN' || user.role === 'PRESIDENTS') {
      // no filter — they see everything
      return {};
    }

    if (user.role === 'OFFICE_HEAD') {
      // only see goals from their own office
      return { officeId: user.officeId };
    }

    // for DIRECTORS and VICE_PRESIDENTS — hierarchy filter goes here
    // (implement when office tree queries are available)
    return { officeId: user.officeId };
  }
}
```

---

## DTO Pattern

DTOs define the shape of request bodies. Every field must have:

- A `class-validator` decorator (e.g., `@IsString()`)
- An `@ApiProperty()` decorator for Swagger docs
- `@IsOptional()` for optional fields

```ts
// src/goals/dto/create-goal.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateGoalDto {
  /** The goal title — required, max 200 characters */
  @ApiProperty({ example: 'Improve Student Retention Rate' })
  @IsString()
  @MaxLength(200)
  title: string;

  /** Optional longer description of the goal */
  @ApiPropertyOptional({ example: 'Achieve 85% retention by end of year.' })
  @IsOptional()
  @IsString()
  description?: string;

  /** The office this goal belongs to */
  @ApiProperty({ example: 'cld3k8x2g0000xyzabc12345' })
  @IsString()
  officeId: string;

  /** Optional deadline for completing this goal */
  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  targetDate?: string;
}
```

---

## Error Handling Rules

Always use NestJS built-in exceptions. Never throw generic `Error`.

| Situation                       | Exception to throw      |
| ------------------------------- | ----------------------- |
| Resource not found in DB        | `NotFoundException`     |
| User lacks permission           | `ForbiddenException`    |
| Invalid input not caught by DTO | `BadRequestException`   |
| Not authenticated / bad token   | `UnauthorizedException` |

**Prisma P2025 (record not found on update/delete):**

```ts
import { Prisma } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

// always catch this error on update and delete operations
try {
  await this.prisma.goal.update({ where: { id }, data });
} catch (error) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    throw new NotFoundException(`Goal with id "${id}" not found.`);
  }
  throw error; // re-throw anything else
}
```

---

## Prisma Rules

- **Never** call `findMany()` without `take` (or pagination from DTO)
- **Always** use `select` to avoid returning sensitive fields (`passwordHash`, `googleId`)
- Use `$transaction` when making multiple writes that must succeed together

```ts
// ✅ Correct: paginated + selected fields
this.prisma.goal.findMany({
  where,
  take: limit,
  skip,
  select: { id: true, title: true, status: true },
});

// ❌ Wrong: no limit, no field selection
this.prisma.goal.findMany({ where });
```

---

## Auth + Roles Pattern

Every controller that serves authenticated users must have both guards.

```ts
@UseGuards(JwtAuthGuard, RolesGuard)  // ← on the class (applies to all methods)
@Controller('goals')
export class GoalsController {}

// Then on each method, declare which roles can access it:
@Roles(Role.ADMIN, Role.OFFICE_HEAD)
@Post()
create() {}
```

The `req.user` object is typed as `AuthenticatedUser`:
**File:** `src/auth/types/authenticated-user.type.ts`

---

## Response Shape Standard

All list responses use this paginated shape:

```ts
// Always return this shape for lists
{
  data: T[],    // the items
  total: number, // total count (for the frontend to compute page count)
  page: number,
  limit: number,
}
```

Single-item responses just return the object directly.

---

## Comment Standard

Use comments to explain **why**, not what.

```ts
// ✅ Good comment
/**
 * We normalize the email to lowercase before lookup
 * because Google sometimes returns mixed-case addresses.
 */
private normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

// ❌ Bad comment — obvious
// returns the user
return user;
```

---

## Suggestions to Add to This File

Ask the agent: _"Add [item] to backend COPILOT_INSTRUCTIONS.md"_

- [ ] Notification module standard (how to trigger notifications from any service)
- [ ] Office hierarchy traversal helper (shared service for finding child offices)
- [ ] Soft delete pattern (add `deletedAt` instead of actually deleting)
- [ ] Audit log pattern (who created/updated/deleted what)
- [ ] Rate limiting configuration (`@nestjs/throttler`)
- [ ] File upload rules (if document attachments are added to goals)
- [ ] Seeding pattern (how to add new seed data without wiping existing)
- [ ] E2E test file standard (Playwright spec structure used in `/test/playwright/`)
- [ ] WebSocket / SSE pattern for real-time notifications
- [ ] Swagger tagging standard (which tags to use and when)
