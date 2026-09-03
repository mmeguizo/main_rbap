# RBAP Backend — Feature Flow Trail

> This file is your **backend code map**.  
> Every HTTP request has a trail. Follow it here to understand exactly which files and functions run from the moment a request arrives at the server to the moment a response is sent back.

---

## How to Read This File

Every trail follows this chain:

```
HTTP Request arrives
  → main.ts (NestJS app bootstrap)
    → Global pipes (ValidationPipe, Transform)
      → Controller method
        → Guard(s) run first (JwtAuthGuard → RolesGuard)
          → Service method (business logic + Prisma)
            → Prisma talks to PostgreSQL
              → Service returns shaped data
                → Controller returns response to client
```

---

## 1. App Bootstrap — How the Server Starts

**File:** `src/main.ts`

```
Node.js runs main.ts
  → NestFactory.create(AppModule)
      → AppModule (src/app.module.ts) registers:
          - PrismaModule    → makes PrismaService available everywhere
          - AuthModule      → registers auth routes + JWT strategy
          - UsersModule     → registers user management routes
          - OfficesModule   → registers office management routes
          - GoalsModule     → registers goals routes
          - ObjectivesModule → registers objectives routes
      → app.setGlobalPrefix('/api/v1')     ← all routes prefixed with this
      → app.useGlobalPipes(ValidationPipe) ← auto-validates all DTOs
      → Swagger is configured at /api/docs ← behind basicAuth middleware
      → app.listen(PORT)                   ← server starts listening
```

---

## 2. Every Authenticated Request — The Standard Flow

Every request to a protected route goes through this pipeline before reaching the controller:

```
Client sends: GET /api/v1/goals
  with header: Authorization: Bearer <access_token>

  → NestJS routes to GoalsController
      → JwtAuthGuard runs first:
          → Reads the Authorization header
          → Validates the JWT signature using JWT_SECRET
          → Decodes payload: { sub: userId, email, role }
          → Calls UsersService.checkUserById(userId)
              → If user not found → throws 401 Unauthorized
              → If user.status === INACTIVE → throws 403 Forbidden
              → If user found and ACTIVE → attaches user to req.user
          → JwtAuthGuard passes ✓

      → RolesGuard runs second:
          → Reads @Roles(...) decorator on the controller method
          → Checks if req.user.role is in the allowed roles list
          → If not → throws 403 Forbidden
          → If yes → RolesGuard passes ✓

      → Controller method runs
          → Service method is called
              → Prisma query runs
                  → Data returned to service
                → Service shapes and returns data
              → Controller returns HTTP 200 with JSON
```

**Files involved:**
| File | Role |
|------|------|
| `src/auth/guards/jwt-auth.guard.ts` | Validates JWT token |
| `src/auth/strategies/jwt-auth.guard.ts` | JWT strategy (decodes token, loads user) |
| `src/auth/roles.guard.ts` | Checks user's role against allowed roles |
| `src/auth/roles.decorator.ts` | `@Roles(...)` decorator |
| `src/users/users.service.ts` → `checkUserById()` | Validates user still exists and is ACTIVE |

---

## 3. Auth — Google OAuth Login

**Endpoint:** `GET /api/v1/auth/google`  
**Controller:** `src/auth/auth.controller.ts` → `googleLogin()`

```
User opens: GET /api/v1/auth/google  (from the frontend redirect)
  → GoogleAuthGuard runs
      → Passport's Google OAuth strategy activates
          → Redirects browser to: accounts.google.com
              → User logs in with @chmsu.edu.ph Google account
                  → Google sends callback to: GET /api/v1/auth/google/callback
                      → GoogleAuthGuard validates the Google profile
                          → Checks domain: must be @chmsu.edu.ph
                          → Finds or creates the user in the database
                          → Attaches user object to req.user
                      → googleCallback() controller method runs
                          → Calls AuthService.login(req.user)
                              → AuthService.issueTokens() generates:
                                  - access_token  (JWT, expires in 15m)
                                  - refresh_token (JWT, expires in 7d)
                              → Returns: { access_token, refresh_token }
```

**Files involved:**
| File | Role |
|------|------|
| `src/auth/auth.controller.ts` → `googleCallback()` | Receives OAuth result, calls login |
| `src/auth/auth.service.ts` → `login()` | Calls `issueTokens()` |
| `src/auth/auth.service.ts` → `issueTokens()` | Signs access + refresh tokens |
| `src/auth/strategies/google.strategy.ts` | Passport strategy — validates Google profile, finds/creates user |

---

## 4. Auth — Dev Login (Development Only)

**Endpoint:** `POST /api/v1/auth/dev-login`  
**Controller:** `src/auth/auth.controller.ts` → `devLogin()`

```
POST /api/v1/auth/dev-login
  body: { "email": "mark.meguizo@chmsu.edu.ph" }

  → DevLoginDto validates the body (class-validator)
  → AuthService.devLogin(email) is called
      → Normalizes email to lowercase
          → Calls UsersService.findByEmail(email)
              → If not found → throws 404 NotFoundException
              → If found and INACTIVE → throws 403 ForbiddenException
          → Calls AuthService.login(user)
              → Returns: { access_token, refresh_token }
```

---

## 5. Auth — Password Login

**Endpoint:** `POST /api/v1/auth/password-login`  
**Controller:** `src/auth/auth.controller.ts` → `passwordLogin()`

```
POST /api/v1/auth/password-login
  body: { "email": "...", "password": "..." }

  → PasswordLoginDto validates the body
  → AuthService.passwordLogin(email, password)
      → normalizeEmail(email)
      → ensureChmsuEmail(email)  ← rejects non @chmsu.edu.ph emails
          → UsersService.findPasswordLoginUserByEmail(email)
              → Returns user with passwordHash field
          → If no passwordHash → throws 401 (account uses Google only)
          → ensureEligibleLoginUser(user.status) ← rejects INACTIVE users
          → bcryptjs.compare(password, passwordHash)
              → If mismatch → throws 401 Unauthorized
          → AuthService.login(user)
              → Returns: { access_token, refresh_token }
```

---

## 6. Auth — Get Current User Profile

**Endpoint:** `GET /api/v1/auth/me`  
**Controller:** `src/auth/auth.controller.ts` → `getMe()`

```
GET /api/v1/auth/me
  Authorization: Bearer <access_token>

  → JwtAuthGuard validates token and attaches user to req.user
  → getMe() controller method runs
      → Returns req.user directly
          → No service call needed — user is already in req
```

---

## 7. Auth — Refresh Token

**Endpoint:** `POST /api/v1/auth/refresh`  
**Controller:** `src/auth/auth.controller.ts` → `refresh()`

```
POST /api/v1/auth/refresh
  body: { "refresh_token": "..." }

  → AuthService.refreshTokens(refreshToken)
      → jwtService.verify(refreshToken, { secret: JWT_REFRESH_SECRET })
          → If invalid/expired → throws 401 Unauthorized
      → Calls UsersService.findById(payload.sub)
          → If not found or INACTIVE → throws 401/403
      → Calls AuthService.issueTokens(user)
          → Returns fresh: { access_token, refresh_token }
```

---

## 8. Users — Admin Manages Users

**Base endpoint:** `/api/v1/users`  
**Controller:** `src/users/users.controller.ts`

### Get User by ID

```
GET /api/v1/users/:id
  Authorization: Bearer <admin_token>

  → JwtAuthGuard + RolesGuard (ADMIN only)
  → UsersController.findOne(id)
      → UsersService.findById(id)
          → prisma.user.findUnique({ where: { id }, select: {...} })
              → If not found → throws 404
              → Returns shaped user object (no googleId, no passwordHash)
```

### Assign User Role

```
PATCH /api/v1/users/:id/role
  body: { "role": "OFFICE_HEAD" }

  → JwtAuthGuard + RolesGuard (ADMIN only)
  → UsersController.assignRole(id, dto)
      → UsersService.assignRole(id, role)
          → prisma.user.update({ where: { id }, data: { role } })
              → Catch P2025 → throw 404 if user not found
              → Returns updated user
```

### Assign User to Office

```
PATCH /api/v1/users/:id/office
  body: { "officeId": "cld3k8..." }

  → UsersService.assignOffice(id, officeId)
      → prisma.user.update({ where: { id }, data: { officeId } })
```

### Activate / Deactivate User

```
PATCH /api/v1/users/:id/status
  body: { "status": "INACTIVE" }

  → UsersService.updateStatus(id, status)
      → prisma.user.update({ where: { id }, data: { status } })
```

**Files involved:**
| File | Role |
|------|------|
| `src/users/users.controller.ts` | Route handlers for user management |
| `src/users/users.service.ts` | findById, checkUserById, findByEmail, assignRole, assignOffice, updateStatus |

---

## 9. Offices — Office Management

**Base endpoint:** `/api/v1/offices`  
**Controller:** `src/offices/offices.controller.ts`

### Get All Offices (Paginated)

```
GET /api/v1/offices?page=1&limit=10

  → PaginationDto validates query params
  → OfficesController.findAll(query)
      → OfficesService.findAll(query)
          → prisma.office.findMany({ take: limit, skip, select: {...} })
          → prisma.office.count()
          → Returns: { data, total, page, limit }
```

### Create Office

```
POST /api/v1/offices/add-office
  body: { "name": "...", "parentId": "..." }

  → CreateOfficeDto validates body
  → OfficesService.create(dto)
      → prisma.office.create({ data: { name, parentId } })
          → Returns created office
```

---

## 10. Goals — Office Head Creates and Manages Goals

**Base endpoint:** `/api/v1/goals`  
**Controller:** `src/goals/goals.controller.ts`

### Create Goal

```
POST /api/v1/goals
  Authorization: Bearer <office_head_token>
  body: { "title": "...", "officeId": "...", "targetDate": "..." }

  → JwtAuthGuard: validates token, attaches req.user
  → RolesGuard: checks role is OFFICE_HEAD or ADMIN
  → GoalsController.create(req.user, dto)
      → GoalsService.create(user, dto)
          → Checks: user.officeId === dto.officeId
              → If mismatch → throws 403 ForbiddenException
          → prisma.goal.create({ data: {...}, select: {...} })
              → Returns: created goal (shaped — no sensitive fields)
```

### Get All Goals (Role-Filtered)

```
GET /api/v1/goals?page=1&limit=10
  Authorization: Bearer <any_role_token>

  → GoalsService.findAll(user, query)
      → buildGoalVisibilityFilter(user)
          → ADMIN / PRESIDENTS → where: {}           (all goals)
          → OFFICE_HEAD        → where: { officeId } (own office only)
          → DIRECTORS          → where: { office.parentId: user.officeId }
          → VICE_PRESIDENTS    → where: (offices under their scope)
      → prisma.$transaction([findMany, count])
          → Returns: { data, total, page, limit }
```

---

## 11. Objectives — Tasks Under a Goal

**Base endpoint:** `/api/v1/goals/:goalId/objectives`  
**Controller:** `src/objectives/objectives.controller.ts`

```
POST /api/v1/goals/:goalId/objectives
  body: { "title": "...", "targetDate": "..." }

  → ObjectivesService.create(user, goalId, dto)
      → Validates: goal exists and belongs to user's office
      → prisma.objective.create({ data: { goalId, title, ...} })
          → After create: recalculate parent goal status
              → ObjectivesService.recalculateGoalStatus(goalId)
                  → count objectives by status
                  → if all COMPLETED → goal.status = COMPLETED
                  → if any IN_PROGRESS → goal.status = IN_PROGRESS
                  → if all NOT_STARTED → goal.status = NOT_STARTED
                  → prisma.goal.update({ where: { id: goalId }, data: { status } })
```

---

## Quick Reference: Where Is Each Thing?

| Thing                       | File                                          |
| --------------------------- | --------------------------------------------- |
| App entry point             | `src/main.ts`                                 |
| App module (all modules)    | `src/app.module.ts`                           |
| Prisma client wrapper       | `src/prisma/prisma.service.ts`                |
| JWT token issuing           | `src/auth/auth.service.ts` → `issueTokens()`  |
| Google OAuth strategy       | `src/auth/strategies/google.strategy.ts`      |
| JWT validation strategy     | `src/auth/strategies/jwt-auth.guard.ts`       |
| JWT guard (protects routes) | `src/auth/guards/jwt-auth.guard.ts`           |
| Roles guard                 | `src/auth/roles.guard.ts`                     |
| Roles decorator             | `src/auth/roles.decorator.ts`                 |
| Auth controller             | `src/auth/auth.controller.ts`                 |
| Auth service (logic)        | `src/auth/auth.service.ts`                    |
| Users controller            | `src/users/users.controller.ts`               |
| Users service               | `src/users/users.service.ts`                  |
| Offices controller          | `src/offices/offices.controller.ts`           |
| Offices service             | `src/offices/offices.service.ts`              |
| Goals controller            | `src/goals/goals.controller.ts`               |
| Goals service               | `src/goals/goals.service.ts`                  |
| Objectives controller       | `src/objectives/objectives.controller.ts`     |
| Objectives service          | `src/objectives/objectives.service.ts`        |
| Database schema             | `prisma/schema.prisma`                        |
| DB seed script              | `prisma/seed.ts`                              |
| Environment variables       | `.env` (never commit this file)               |
| Swagger docs                | `GET /api/docs` (basicAuth required)          |
| E2E tests (Playwright)      | `test/playwright/api-endpoints.audit.spec.ts` |
