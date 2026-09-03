# Session Context — RBAP IDM Backend

**Last updated:** May 11, 2026 (objectives + wiring revalidated, README refreshed)  
**Project path:** `c:\Users\markm\Desktop\BACKEND for RBAP_IDM\rbap-idm-backend`

---

## Current Reality Of The Repo

The old context was outdated. The repo is no longer just `auth`, `users`, and `offices`.

The backend now includes the first RBAP implementation layer:

- `plans` module
- `goals` module
- `objectives` module

These are already wired into `AppModule` and the source tree currently has **no compile errors**.

---

## RBAP Data Model Already Added

In `prisma/schema.prisma`, the following are now present:

- `Plan`
- `Goal`
- `Objective`
- `PlanStatus` enum: `DRAFT | SUBMITTED | APPROVED`
- `GoalStatus` enum: `NOT_STARTED | IN_PROGRESS | COMPLETED`

### Structure

```text
Plan
 └── Goal
      └── Objective
```

### Meaning

- `Plan` = annual RBAP document/header for one office and one year
- `Goal` = outcome row from the Excel RBAP
- `Objective` = output row under a goal

### Important DB rule

- `Plan` has a unique constraint on `(officeId, planningYear)`
  - one office can only have one plan for a given year

### Migration already created/applied

- `prisma/migrations/20260511075051_add_rbap_plan_goal_objective/`

---

## Access / Hierarchy Logic Already Added

Hierarchy logic lives in:

- `src/offices/offices.service.ts`

Important methods already added:

- `getAccessibleOfficeIds(user)`
- `canAccessOffice(user, officeId)`
- `findAccessibleOffices(user)`

### Access rules currently implemented

- `OFFICE_HEAD` → own office only
- `DIRECTORS` → own office + direct child offices
- `VICE_PRESIDENTS` → own office + subtree below
- `PRESIDENTS` → all active offices
- `ADMIN` → all active offices

This hierarchy logic is already reused by plans/goals/objectives services.

---

## RBAP Endpoints Already Built

### Plans

- `POST /api/v1/plans`
- `GET /api/v1/plans`
- `GET /api/v1/plans/summary`
- `GET /api/v1/plans/pending-approvals`
- `GET /api/v1/plans/:id`
- `PATCH /api/v1/plans/:id`
- `DELETE /api/v1/plans/:id`
- `PATCH /api/v1/plans/:id/submit`
- `PATCH /api/v1/plans/:id/approve`

### Goals (nested CRUD)

- `POST /api/v1/plans/:planId/goals`
- `GET /api/v1/plans/:planId/goals`
- `GET /api/v1/plans/:planId/goals/:id`
- `PATCH /api/v1/plans/:planId/goals/:id`
- `DELETE /api/v1/plans/:planId/goals/:id`

### Goals (top-level browse)

- `GET /api/v1/goals`
- `GET /api/v1/goals/:id`

### Objectives (nested CRUD)

- `POST /api/v1/plans/:planId/goals/:goalId/objectives`
- `GET /api/v1/plans/:planId/goals/:goalId/objectives`
- `GET /api/v1/plans/:planId/goals/:goalId/objectives/:id`
- `PATCH /api/v1/plans/:planId/goals/:goalId/objectives/:id`
- `DELETE /api/v1/plans/:planId/goals/:goalId/objectives/:id`

### Objectives (top-level browse)

- `GET /api/v1/objectives`
- `GET /api/v1/objectives/:id`

### Offices helper endpoint

- `GET /api/v1/offices/accessible`

---

## Filters Already Supported

### `GET /plans`

- `take`
- `skip`
- `officeId`
- `planningYear`
- `status`

### `GET /plans/summary`

- `officeId`
- `planningYear`

### `GET /plans/pending-approvals`

- `take`
- `skip`
- `officeId`
- `planningYear`

### `GET /goals`

- `take`
- `skip`
- `officeId`
- `planId`
- `planningYear`
- `status`

### `GET /objectives`

- `take`
- `skip`
- `officeId`
- `planId`
- `goalId`
- `planningYear`
- `status`

---

## Important RBAP Files

### Prisma

- `prisma/schema.prisma`
- `prisma/migrations/20260511075051_add_rbap_plan_goal_objective/migration.sql`

### Shared auth / scope

- `src/auth/types/authenticated-user.type.ts`
- `src/offices/offices.service.ts`
- `src/offices/offices.controller.ts`

### Plans

- `src/plans/plans.module.ts`
- `src/plans/plans.controller.ts`
- `src/plans/plans.service.ts`
- `src/plans/dto/create-plan.dto.ts`
- `src/plans/dto/update-plan.dto.ts`
- `src/plans/dto/query-plans.dto.ts`

### Goals

- `src/goals/goals.module.ts`
- `src/goals/goals.controller.ts`
- `src/goals/goals-browse.controller.ts`
- `src/goals/goals.service.ts`
- `src/goals/dto/create-goal.dto.ts`
- `src/goals/dto/update-goal.dto.ts`
- `src/goals/dto/query-goals.dto.ts`

### Objectives

- `src/objectives/objectives.module.ts`
- `src/objectives/objectives.controller.ts`
- `src/objectives/objectives-browse.controller.ts`
- `src/objectives/objectives.service.ts`
- `src/objectives/dto/create-objective.dto.ts`
- `src/objectives/dto/update-objective.dto.ts`
- `src/objectives/dto/query-objectives.dto.ts`

---

## Existing Non-RBAP Notes Still Relevant

### Auth / Swagger

- Global prefix is `/api/v1`
- Swagger URL is `/api/docs`
- Swagger basic auth was previously confirmed as `admin / admin`
- Dev login email used in previous testing: `mark.meguizo@chmsu.edu.ph`

### Existing known bug not yet fixed

`GET /user/user-id` can still throw a 500 if `userId` query param is missing.

Root cause:

- controller passes `undefined` into `usersService.findById()`
- Prisma receives `where: { id: undefined }`

Suggested future fix:

```ts
if (!userId) {
  throw new BadRequestException("userId query param is required");
}
```

### Old browser test data note

Earlier Playwright testing created temporary office records in the database. Those were never part of the RBAP implementation itself.

---

## Testing / Validation Status

- User explicitly said: **do not prioritize testing for now**
- We have been using **compile/error validation only** after edits
- Current status: **source tree has no reported compile errors**

### Latest maintenance sync

- Re-checked that `ObjectivesModule` is wired into `AppModule`
- Re-checked that the objectives service exists and the RBAP objective slice is implemented
- Re-ran source validation and `src` still reports no compile errors
- Replaced the backend `README.md` default Nest starter content with RBAP IDM project documentation
- The remaining todo items for `Build objectives module` and `Wire modules and validate` should now be treated as completed

---

## Most Recent Work Before This Update

Immediately before this context rewrite, the backend gained:

- top-level filtered browse for goals
- top-level filtered browse for objectives
- direct detail endpoints `GET /goals/:id` and `GET /objectives/:id`
- plan dashboard summary endpoint `GET /plans/summary`
- submitted review queue endpoint `GET /plans/pending-approvals`

This means the frontend can already:

1. list visible offices with `/offices/accessible`
2. list plans with filters
3. show plan dashboard counts by status, office, and year
4. show submitted plans waiting for supervisor review
5. list goals without knowing `planId` first
6. list objectives without knowing `goalId` first
7. open one goal or objective directly from a dashboard table

---

## Recommended Next Step

The next logical backend step after this context update is:

- either frontend integration using the current endpoints
- or add goal/objective summary endpoints if the dashboard needs deeper analytics

Examples of what already exists now:

- `GET /plans/summary`
- `GET /plans/pending-approvals`

Reason:

- supervisors can now browse rows and see plan-level dashboard counts
- the next gap is either frontend hookup or deeper goal/objective aggregation

---

## May 20, 2026 - Manual User Creation, Auth Register & Office Validations

### 1. User Creation & Registration
- **Manual User Creation (`POST /api/v1/user`)**: Added an admin-only endpoint to pre-create users with a default role of `OFFICE_HEAD` and a placeholder `googleId = 'manual-' + email`.
- **User Email Registration (`POST /api/v1/auth/register`)**: Added a public endpoint to register accounts with an `@chmsu.edu.ph` email and password (defaulting to the `OFFICE_HEAD` role with no department).
- **Auto-Linking Google OAuth**: Enhanced `findOrCreate` in `UsersService` to look up by email as a fallback. When a manually created or email-registered user logs in via Google OAuth for the first time, the backend automatically links their Google profile ID to their existing account on-the-fly.
- **Refined Password Login Errors**: Updated `passwordLogin` in `AuthService` to throw specific warning messages (e.g. telling the client to register if the email doesn't exist, or to sign in via Google if they have no password set).

### 2. Office & Leader Validations
- **Parent Office Validation**: In `addOffice` and `updateOffice` inside `OfficesService`, we now verify that the provided `parentId` exists in the database, throwing a `NotFoundException` if it is missing.
- **Head of Office Uniqueness Validation**: Verified that a user is not already heading another office before assigning them as the head of an office, returning a `BadRequestException` if a violation occurs (preventing database unique constraint exceptions).

