# Playwright API Audit Report

- Generated at: 2026-05-21T08:30:28.774Z
- Run tag: 202605210830265585
- Base URL: http://localhost:3000/api/v1/

## Summary

- Total steps: 50
- Passed: 49
- Failed: 1
- Skipped: 0

## Why The Audit Seeds Some Data Directly

- The API has dev-login, but it does not have a public create-user endpoint.
- Because of that, the audit inserts traceable users and offices with Prisma first, then authenticates those same users through POST /auth/dev-login.
- This keeps auth, guards, and endpoint behavior under test while still making the run repeatable.

## Happy-Path And Policy Checks

| Category | Module | Step | Method | Path | Expected | Actual | Outcome |
| --- | --- | --- | --- | --- | --- | --- | --- |
| happy-path | Auth | Dev login for ADMIN bootstrap | POST | /auth/dev-login | 200 | 200 | passed |
| happy-path | Auth | Dev login for OFFICE_HEAD fixture | POST | /auth/dev-login | 200 | 200 | passed |
| happy-path | Auth | Dev login for DIRECTOR fixture | POST | /auth/dev-login | 200 | 200 | passed |
| happy-path | Auth | Get authenticated admin profile | GET | /auth/me | 200 | 200 | passed |
| happy-path | Auth | Refresh admin tokens | POST | /auth/refresh | 200 | 200 | passed |
| happy-path | Auth | Dev login for OFFICE_HEAD auth/me check | POST | /auth/dev-login | 200 | 200 | passed |
| happy-path | Auth | Get authenticated office head profile | GET | /auth/me | 200 | 200 | passed |
| happy-path | Users | List users | GET | /user?take=20&skip=0 | 200 | 200 | passed |
| happy-path | Users | List users without office | GET | /user/without-office | 200 | 200 | passed |
| happy-path | Users | Get user by id | GET | /user/user-id?userId=cmpf8dhdp0003pgv8dpqnjo8t | 200 | 200 | passed |
| happy-path | Users | Get user by email | GET | /user/user-email?email=api.audit.202605210830265585.office-head%40chmsu.edu.ph | 200 | 200 | passed |
| happy-path | Users | Change a user role | POST | /user/assign-role | 200 | 200 | passed |
| happy-path | Users | Assign a user to an office | POST | /user/assign-office | 200 | 200 | passed |
| happy-path | Users | Toggle a user status | POST | /user/change-user-status | 200 | 200 | passed |
| happy-path | Offices | List active offices | GET | /offices?take=20&skip=0 | 200 | 200 | passed |
| happy-path | Offices | Create a temporary office | POST | /offices/add-office | 201 | 201 | passed |
| happy-path | Offices | Update the temporary office | PATCH | /offices/update-office | 200 | 200 | passed |
| happy-path | Offices | Delete the temporary office | POST | /offices/delete-office | 200 | 200 | passed |
| happy-path | Offices | List office head accessible offices | GET | /offices/accessible | 200 | 200 | passed |
| happy-path | Offices | List director accessible offices | GET | /offices/accessible | 200 | 200 | passed |
| happy-path | Plans | Create a draft RBAP plan | POST | /plans | 201 | 201 | passed |
| happy-path | Plans | List visible plans for the office head | GET | /plans?planningYear=2030&take=10&skip=0 | 200 | 200 | passed |
| happy-path | Plans | Get one plan | GET | /plans/cmpf8di7g0001y8v8edk1hr5e | 200 | 200 | passed |
| happy-path | Plans | Update a draft plan | PATCH | /plans/cmpf8di7g0001y8v8edk1hr5e | 200 | 200 | passed |
| happy-path | Plans | Create a second draft plan for delete coverage | POST | /plans | 201 | 201 | passed |
| happy-path | Goals | Create a goal under the primary plan | POST | /plans/cmpf8di7g0001y8v8edk1hr5e/goals | 201 | 201 | passed |
| happy-path | Goals | Create a second goal for delete coverage | POST | /plans/cmpf8di7g0001y8v8edk1hr5e/goals | 201 | 201 | passed |
| happy-path | Goals | List goals under a plan | GET | /plans/cmpf8di7g0001y8v8edk1hr5e/goals?take=10&skip=0 | 200 | 200 | passed |
| happy-path | Goals | Get one goal under a plan | GET | /plans/cmpf8di7g0001y8v8edk1hr5e/goals/cmpf8dic10003y8v8ugr77wmj | 200 | 200 | passed |
| happy-path | Goals | Update a goal | PATCH | /plans/cmpf8di7g0001y8v8edk1hr5e/goals/cmpf8dic10003y8v8ugr77wmj | 200 | 200 | passed |
| happy-path | Goals | Browse goals without plan id | GET | /goals?planningYear=2030&planId=cmpf8di7g0001y8v8edk1hr5e&take=10&skip=0 | 200 | 200 | passed |
| happy-path | Goals | Get one goal without plan id | GET | /goals/cmpf8dic10003y8v8ugr77wmj | 200 | 200 | passed |
| happy-path | Objectives | Create an objective under the primary goal | POST | /plans/cmpf8di7g0001y8v8edk1hr5e/goals/cmpf8dic10003y8v8ugr77wmj/objectives | 201 | 201 | passed |
| happy-path | Objectives | Create a second objective for delete coverage | POST | /plans/cmpf8di7g0001y8v8edk1hr5e/goals/cmpf8dic10003y8v8ugr77wmj/objectives | 201 | 201 | passed |
| happy-path | Objectives | List objectives under a goal | GET | /plans/cmpf8di7g0001y8v8edk1hr5e/goals/cmpf8dic10003y8v8ugr77wmj/objectives?take=10&skip=0 | 200 | 200 | passed |
| happy-path | Objectives | Get one objective under a goal | GET | /plans/cmpf8di7g0001y8v8edk1hr5e/goals/cmpf8dic10003y8v8ugr77wmj/objectives/cmpf8dign0005y8v8ys9d8tz8 | 200 | 200 | passed |
| happy-path | Objectives | Update an objective | PATCH | /plans/cmpf8di7g0001y8v8edk1hr5e/goals/cmpf8dic10003y8v8ugr77wmj/objectives/cmpf8dign0005y8v8ys9d8tz8 | 200 | 200 | passed |
| happy-path | Objectives | Browse objectives without goal id | GET | /objectives?planningYear=2030&goalId=cmpf8dic10003y8v8ugr77wmj&take=10&skip=0 | 200 | 200 | passed |
| happy-path | Objectives | Get one objective without goal id | GET | /objectives/cmpf8dign0005y8v8ys9d8tz8 | 200 | 200 | passed |
| happy-path | Objectives | Delete the disposable objective | DELETE | /plans/cmpf8di7g0001y8v8edk1hr5e/goals/cmpf8dic10003y8v8ugr77wmj/objectives/cmpf8dih10006y8v8xj3uhdgd | 200 | 200 | passed |
| happy-path | Goals | Delete the disposable goal | DELETE | /plans/cmpf8di7g0001y8v8edk1hr5e/goals/cmpf8dicv0004y8v8cnryzati | 200 | 200 | passed |
| happy-path | Plans | Get plan summary for a director view | GET | /plans/summary?officeId=cmpf8dhf9000apgv81bj9cbpo&planningYear=2030 | 200 | 200 | passed |
| happy-path | Plans | Delete the disposable draft plan | DELETE | /plans/cmpf8dibj0002y8v8mp1gclvz | 200 | 200 | passed |
| happy-path | Plans | Submit the primary plan | PATCH | /plans/cmpf8di7g0001y8v8edk1hr5e/submit | 200 | 200 | passed |
| policy-check | Plans | Policy check: block updates after submission | PATCH | /plans/cmpf8di7g0001y8v8edk1hr5e | 403 | 403 | passed |
| happy-path | Plans | List pending approvals for the director | GET | /plans/pending-approvals?planningYear=2030&take=10&skip=0 | 200 | 200 | passed |
| happy-path | Plans | Approve the submitted plan as director | PATCH | /plans/cmpf8di7g0001y8v8edk1hr5e/approve | 200 | 200 | passed |
| happy-path | Plans | List visible plans for the director | GET | /plans?officeId=cmpf8dhf9000apgv81bj9cbpo&planningYear=2030&take=10&skip=0 | 200 | 200 | passed |
| happy-path | Plans | Get summary after approval | GET | /plans/summary?planningYear=2030 | 200 | 200 | passed |

## Known Issue Checks

| Module | Step | Method | Path | Expected | Actual | Outcome | Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Users | Known issue check: missing userId query param | GET | /user/user-id | 400 | 500 | failed |  |

## Inserted Fixture Users

| Role | Id | Email | OfficeId | Status |
| --- | --- | --- | --- | --- |
| president | cmpf8dh9c0000pgv8iu4pbn4d | api.audit.202605210830265585.president@chmsu.edu.ph | cmpf8dheu0007pgv8ni9saq7w | ACTIVE |
| vicePresident | cmpf8dhdb0001pgv8391fh117 | api.audit.202605210830265585.vice-president@chmsu.edu.ph | cmpf8dhf30008pgv8mtkyd1uo | ACTIVE |
| director | cmpf8dhdj0002pgv8dfi1chl6 | api.audit.202605210830265585.director@chmsu.edu.ph | cmpf8dhf70009pgv8xne2sw1m | ACTIVE |
| officeHead | cmpf8dhdp0003pgv8dpqnjo8t | api.audit.202605210830265585.office-head@chmsu.edu.ph | cmpf8dhf9000apgv81bj9cbpo | ACTIVE |
| unassigned | cmpf8dhdx0004pgv8kull2mnj | api.audit.202605210830265585.unassigned@chmsu.edu.ph | null | ACTIVE |
| assignable | cmpf8dhe00005pgv8x8oj81co | api.audit.202605210830265585.assignable@chmsu.edu.ph | null | ACTIVE |
| newOfficeHead | cmpf8dher0006pgv8o4i4lfn2 | api.audit.202605210830265585.new-office-head@chmsu.edu.ph | null | ACTIVE |

## Inserted Fixture Offices

| Office | Id | ParentId | HeadId | Status |
| --- | --- | --- | --- | --- |
| president | cmpf8dheu0007pgv8ni9saq7w | null | cmpf8dh9c0000pgv8iu4pbn4d | ACTIVE |
| vicePresident | cmpf8dhf30008pgv8mtkyd1uo | cmpf8dheu0007pgv8ni9saq7w | cmpf8dhdb0001pgv8391fh117 | ACTIVE |
| director | cmpf8dhf70009pgv8xne2sw1m | cmpf8dhf30008pgv8mtkyd1uo | cmpf8dhdj0002pgv8dfi1chl6 | ACTIVE |
| officeHead | cmpf8dhf9000apgv81bj9cbpo | cmpf8dhf70009pgv8xne2sw1m | cmpf8dhdp0003pgv8dpqnjo8t | ACTIVE |

## API-Created Record Ids

| Table | Ids |
| --- | --- |
| Office | cmpf8di560000y8v8lkdk6pa6 |
| Plan | cmpf8di7g0001y8v8edk1hr5e, cmpf8dibj0002y8v8mp1gclvz |
| Goal | cmpf8dic10003y8v8ugr77wmj, cmpf8dicv0004y8v8cnryzati |
| Objective | cmpf8dign0005y8v8ys9d8tz8, cmpf8dih10006y8v8xj3uhdgd |

## Final Database Snapshot

### Users

| Id | Email | Role | Status | OfficeId |
| --- | --- | --- | --- | --- |
| cmpf8dhe00005pgv8x8oj81co | api.audit.202605210830265585.assignable@chmsu.edu.ph | DIRECTORS | INACTIVE | cmpf8dhf9000apgv81bj9cbpo |
| cmpf8dhdj0002pgv8dfi1chl6 | api.audit.202605210830265585.director@chmsu.edu.ph | DIRECTORS | ACTIVE | cmpf8dhf70009pgv8xne2sw1m |
| cmpf8dher0006pgv8o4i4lfn2 | api.audit.202605210830265585.new-office-head@chmsu.edu.ph | OFFICE_HEAD | ACTIVE | null |
| cmpf8dhdp0003pgv8dpqnjo8t | api.audit.202605210830265585.office-head@chmsu.edu.ph | OFFICE_HEAD | ACTIVE | cmpf8dhf9000apgv81bj9cbpo |
| cmpf8dh9c0000pgv8iu4pbn4d | api.audit.202605210830265585.president@chmsu.edu.ph | PRESIDENTS | ACTIVE | cmpf8dheu0007pgv8ni9saq7w |
| cmpf8dhdx0004pgv8kull2mnj | api.audit.202605210830265585.unassigned@chmsu.edu.ph | OFFICE_HEAD | ACTIVE | null |
| cmpf8dhdb0001pgv8391fh117 | api.audit.202605210830265585.vice-president@chmsu.edu.ph | VICE_PRESIDENTS | ACTIVE | cmpf8dhf30008pgv8mtkyd1uo |

### Offices

| Id | Name | ParentId | HeadId | Status |
| --- | --- | --- | --- | --- |
| cmpf8dhf70009pgv8xne2sw1m | API AUDIT DIRECTOR 202605210830265585 | cmpf8dhf30008pgv8mtkyd1uo | cmpf8dhdj0002pgv8dfi1chl6 | ACTIVE |
| cmpf8dhf9000apgv81bj9cbpo | API AUDIT OFFICE HEAD 202605210830265585 | cmpf8dhf70009pgv8xne2sw1m | cmpf8dhdp0003pgv8dpqnjo8t | ACTIVE |
| cmpf8dheu0007pgv8ni9saq7w | API AUDIT PRESIDENT 202605210830265585 | null | cmpf8dh9c0000pgv8iu4pbn4d | ACTIVE |
| cmpf8di560000y8v8lkdk6pa6 | API AUDIT TEMP OFFICE RENAMED 202605210830265585 | cmpf8dheu0007pgv8ni9saq7w | null | INACTIVE |
| cmpf8dhf30008pgv8mtkyd1uo | API AUDIT VP 202605210830265585 | cmpf8dheu0007pgv8ni9saq7w | cmpf8dhdb0001pgv8391fh117 | ACTIVE |

### Plans

| Id | OfficeId | CreatedById | PlanningYear | Status | SubmittedAt | ApprovedAt |
| --- | --- | --- | --- | --- | --- | --- |
| cmpf8di7g0001y8v8edk1hr5e | cmpf8dhf9000apgv81bj9cbpo | cmpf8dhdp0003pgv8dpqnjo8t | 2030 | APPROVED | Thu May 21 2026 16:30:28 GMT+0800 (Philippine Standard Time) | Thu May 21 2026 16:30:28 GMT+0800 (Philippine Standard Time) |

### Goals

| Id | PlanId | OfficeId | CreatedById | ResultLevel | Status |
| --- | --- | --- | --- | --- | --- |
| cmpf8dic10003y8v8ugr77wmj | cmpf8di7g0001y8v8edk1hr5e | cmpf8dhf9000apgv81bj9cbpo | cmpf8dhdp0003pgv8dpqnjo8t | Result Level primary goal 202605210830265585 | IN_PROGRESS |

### Objectives

| Id | GoalId | CreatedById | ResultLevel | Status |
| --- | --- | --- | --- | --- |
| cmpf8dign0005y8v8ys9d8tz8 | cmpf8dic10003y8v8ugr77wmj | cmpf8dhdp0003pgv8dpqnjo8t | Result Level primary objective 202605210830265585 | COMPLETED |

## How To Inspect The Rows In PostgreSQL

- Filter users by email prefix like `api.audit.` and the run tag shown above.
- Filter offices by names that start with `API AUDIT`.
- Match plans, goals, and objectives with the ids listed in the API-created records table.

## Flow Map

- See docs/rbap-api-flow-map.md for the table relationship map and the request lifecycle.

## Raw Response Notes

### Auth - Dev login for ADMIN bootstrap

- Endpoint: POST /auth/dev-login
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "access_token": "<redacted>",
  "refresh_token": "<redacted>"
}
```

### Auth - Dev login for OFFICE_HEAD fixture

- Endpoint: POST /auth/dev-login
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "access_token": "<redacted>",
  "refresh_token": "<redacted>"
}
```

### Auth - Dev login for DIRECTOR fixture

- Endpoint: POST /auth/dev-login
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "access_token": "<redacted>",
  "refresh_token": "<redacted>"
}
```

### Auth - Get authenticated admin profile

- Endpoint: GET /auth/me
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmnockzva00008cv8pmywwzs8",
  "email": "mark.meguizo@chmsu.edu.ph",
  "name": "Mark Meguizo",
  "avatar": "https://lh3.googleusercontent.com/a/ACg8ocL3OP9MS9tM18ZN2RdvhBXtMO19xV5vYcioFhzPKDGzZi72hg=s96-c",
  "status": "ACTIVE",
  "role": "ADMIN",
  "passwordHash": "$2a$10$TvH5VbKc/uv0yNlRCcbaQ.JHddxNiobhDRX6.pI8x2Hoh6T8B5zim",
  "office": {
    "id": "cmnzr74pb0000i4v8sl99f7je",
    "name": "PRESIDENT"
  },
  "hasPassword": true
}
```

### Auth - Refresh admin tokens

- Endpoint: POST /auth/refresh
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "access_token": "<redacted>",
  "refresh_token": "<redacted>"
}
```

### Auth - Dev login for OFFICE_HEAD auth/me check

- Endpoint: POST /auth/dev-login
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "access_token": "<redacted>",
  "refresh_token": "<redacted>"
}
```

### Auth - Get authenticated office head profile

- Endpoint: GET /auth/me
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8dhdp0003pgv8dpqnjo8t",
  "email": "api.audit.202605210830265585.office-head@chmsu.edu.ph",
  "name": "API Audit office-head 202605210830265585",
  "avatar": null,
  "status": "ACTIVE",
  "role": "OFFICE_HEAD",
  "passwordHash": null,
  "office": {
    "id": "cmpf8dhf9000apgv81bj9cbpo",
    "name": "API AUDIT OFFICE HEAD 202605210830265585"
  },
  "hasPassword": false
}
```

### Users - List users

- Endpoint: GET /user?take=20&skip=0
- Expected: 200
- Actual: 200
- Outcome: passed
```json
[
  {
    "id": "cmpf8dhe00005pgv8x8oj81co",
    "email": "api.audit.202605210830265585.assignable@chmsu.edu.ph",
    "name": "API Audit assignable 202605210830265585",
    "avatar": null,
    "status": "ACTIVE",
    "role": "OFFICE_HEAD",
    "office": null
  },
  {
    "id": "cmpf8dhdj0002pgv8dfi1chl6",
    "email": "api.audit.202605210830265585.director@chmsu.edu.ph",
    "name": "API Audit director 202605210830265585",
    "avatar": null,
    "status": "ACTIVE",
    "role": "DIRECTORS",
    "office": {
      "id": "cmpf8dhf70009pgv8xne2sw1m",
      "name": "API AUDIT DIRECTOR 202605210830265585"
    }
  },
  {
    "id": "cmpf8dher0006pgv8o4i4lfn2",
    "email": "api.audit.202605210830265585.new-office-head@chmsu.edu.ph",
    "name": "API Audit new-office-head 202605210830265585",
    "avatar": null,
    "status": "ACTIVE",
    "role": "OFFICE_HEAD",
    "office": null
  },
  {
    "id": "cmpf8dhdp0003pgv8dpqnjo8t",
    "email": "api.audit.202605210830265585.office-head@chmsu.edu.ph",
    "name": "API Audit office-head 202605210830265585",
    "avatar": null,
    "status": "ACTIVE",
    "role": "OFFICE_HEAD",
    "office": {
      "id": "cmpf8dhf9000apgv81bj9cbpo",
      "name":...
```

### Users - List users without office

- Endpoint: GET /user/without-office
- Expected: 200
- Actual: 200
- Outcome: passed
```json
[
  {
    "id": "cmpf8dhe00005pgv8x8oj81co",
    "email": "api.audit.202605210830265585.assignable@chmsu.edu.ph",
    "name": "API Audit assignable 202605210830265585",
    "avatar": null,
    "status": "ACTIVE",
    "role": "OFFICE_HEAD",
    "office": null
  },
  {
    "id": "cmpf8dher0006pgv8o4i4lfn2",
    "email": "api.audit.202605210830265585.new-office-head@chmsu.edu.ph",
    "name": "API Audit new-office-head 202605210830265585",
    "avatar": null,
    "status": "ACTIVE",
    "role": "OFFICE_HEAD",
    "office": null
  },
  {
    "id": "cmpf8dhdx0004pgv8kull2mnj",
    "email": "api.audit.202605210830265585.unassigned@chmsu.edu.ph",
    "name": "API Audit unassigned 202605210830265585",
    "avatar": null,
    "status": "ACTIVE",
    "role": "OFFICE_HEAD",
    "office": null
  }
]
```

### Users - Get user by id

- Endpoint: GET /user/user-id?userId=cmpf8dhdp0003pgv8dpqnjo8t
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8dhdp0003pgv8dpqnjo8t",
  "email": "api.audit.202605210830265585.office-head@chmsu.edu.ph",
  "name": "API Audit office-head 202605210830265585",
  "avatar": null,
  "status": "ACTIVE",
  "role": "OFFICE_HEAD",
  "office": {
    "id": "cmpf8dhf9000apgv81bj9cbpo",
    "name": "API AUDIT OFFICE HEAD 202605210830265585"
  }
}
```

### Users - Get user by email

- Endpoint: GET /user/user-email?email=api.audit.202605210830265585.office-head%40chmsu.edu.ph
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8dhdp0003pgv8dpqnjo8t",
  "email": "api.audit.202605210830265585.office-head@chmsu.edu.ph",
  "name": "API Audit office-head 202605210830265585",
  "avatar": null,
  "status": "ACTIVE",
  "role": "OFFICE_HEAD",
  "office": {
    "id": "cmpf8dhf9000apgv81bj9cbpo",
    "name": "API AUDIT OFFICE HEAD 202605210830265585"
  }
}
```

### Users - Change a user role

- Endpoint: POST /user/assign-role
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8dhe00005pgv8x8oj81co",
  "email": "api.audit.202605210830265585.assignable@chmsu.edu.ph",
  "name": "API Audit assignable 202605210830265585",
  "avatar": null,
  "status": "ACTIVE",
  "role": "DIRECTORS",
  "office": null
}
```

### Users - Assign a user to an office

- Endpoint: POST /user/assign-office
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8dhe00005pgv8x8oj81co",
  "email": "api.audit.202605210830265585.assignable@chmsu.edu.ph",
  "name": "API Audit assignable 202605210830265585",
  "avatar": null,
  "status": "ACTIVE",
  "role": "DIRECTORS",
  "office": {
    "id": "cmpf8dhf9000apgv81bj9cbpo",
    "name": "API AUDIT OFFICE HEAD 202605210830265585"
  }
}
```

### Users - Toggle a user status

- Endpoint: POST /user/change-user-status
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8dhe00005pgv8x8oj81co",
  "email": "api.audit.202605210830265585.assignable@chmsu.edu.ph",
  "name": "API Audit assignable 202605210830265585",
  "avatar": null,
  "status": "INACTIVE",
  "role": "DIRECTORS",
  "office": {
    "id": "cmpf8dhf9000apgv81bj9cbpo",
    "name": "API AUDIT OFFICE HEAD 202605210830265585"
  }
}
```

### Users - Known issue check: missing userId query param

- Endpoint: GET /user/user-id
- Expected: 400
- Actual: 500
- Outcome: failed
```json
{
  "statusCode": 500,
  "timestamp": "2026-05-21T08:30:28.070Z",
  "path": "/api/v1/user/user-id",
  "message": "\nInvalid `this.prisma.user.findUnique()` invocation in\nC:\\Users\\markm\\Desktop\\BACKEND for RBAP_IDM\\backend\\src\\users\\users.service.ts:284:41\n\n  281 }\n  282 \n  283 async findAdminUserById(id: string) {\n→ 284   const user = await this.prisma.user.findUnique({\n          where: {\n            id: undefined,\n        ?   email?: String,\n        ?   googleId?: String,\n        ?   AND?: UserWhereInput | UserWhereInput[],\n        ?   OR?: UserWhereInput[],\n        ?   NOT?: UserWhereInput | UserWhereInput[],\n        ?   name?: StringFilter | String,\n        ?   avatar?: StringNullableFilter | String | Null,\n        ?   passwordHash?: StringNullableFilter | String | Null,\n        ?   role?: EnumRoleFilter | Role,\n        ?   createdAt?: DateTimeFilter | DateTime,\n        ?   updatedAt?: DateTimeFilter | DateTime,\n        ?   status?: EnumUserStatusFilter | UserStatus,\n        ?   officeId?: StringNullableFilter | String | Null,\n        ?   office?: OfficeNullableScalarRelationFilter | OfficeWhereInput | Null,\n        ?   headOfOffice?: OfficeNullabl...
```

### Offices - List active offices

- Endpoint: GET /offices?take=20&skip=0
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "data": [
    {
      "id": "cmpf8dhf9000apgv81bj9cbpo",
      "name": "API AUDIT OFFICE HEAD 202605210830265585",
      "parentId": "cmpf8dhf70009pgv8xne2sw1m",
      "headId": "cmpf8dhdp0003pgv8dpqnjo8t",
      "members": [
        {
          "id": "cmpf8dhdp0003pgv8dpqnjo8t",
          "email": "api.audit.202605210830265585.office-head@chmsu.edu.ph",
          "name": "API Audit office-head 202605210830265585",
          "avatar": null,
          "googleId": "api-audit-202605210830265585-office-head",
          "passwordHash": null,
          "role": "OFFICE_HEAD",
          "createdAt": "2026-05-21T08:30:27.133Z",
          "updatedAt": "2026-05-21T08:30:27.219Z",
          "status": "ACTIVE",
          "officeId": "cmpf8dhf9000apgv81bj9cbpo"
        },
        {
          "id": "cmpf8dhe00005pgv8x8oj81co",
          "email": "api.audit.202605210830265585.assignable@chmsu.edu.ph",
          "name": "API Audit assignable 202605210830265585",
          "avatar": null,
          "googleId": "api-audit-202605210830265585-assignable",
          "passwordHash": null,
          "role": "DIRECTORS",
          "createdAt": "2026-05-21T08:30:27.144Z",
          "updatedAt": "2026-05...
```

### Offices - Create a temporary office

- Endpoint: POST /offices/add-office
- Expected: 201
- Actual: 201
- Outcome: passed
```json
{
  "id": "cmpf8di560000y8v8lkdk6pa6",
  "name": "API AUDIT TEMP OFFICE 202605210830265585",
  "parentId": "cmpf8dhf70009pgv8xne2sw1m",
  "headId": "cmpf8dher0006pgv8o4i4lfn2",
  "createdAt": "2026-05-21T08:30:28.122Z",
  "status": "ACTIVE"
}
```

### Offices - Update the temporary office

- Endpoint: PATCH /offices/update-office
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8di560000y8v8lkdk6pa6",
  "name": "API AUDIT TEMP OFFICE RENAMED 202605210830265585",
  "parentId": "cmpf8dheu0007pgv8ni9saq7w",
  "headId": "cmpf8dher0006pgv8o4i4lfn2",
  "createdAt": "2026-05-21T08:30:28.122Z",
  "status": "ACTIVE"
}
```

### Offices - Delete the temporary office

- Endpoint: POST /offices/delete-office
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8di560000y8v8lkdk6pa6",
  "name": "API AUDIT TEMP OFFICE RENAMED 202605210830265585",
  "parentId": "cmpf8dheu0007pgv8ni9saq7w",
  "headId": null,
  "createdAt": "2026-05-21T08:30:28.122Z",
  "status": "INACTIVE"
}
```

### Offices - List office head accessible offices

- Endpoint: GET /offices/accessible
- Expected: 200
- Actual: 200
- Outcome: passed
```json
[
  {
    "id": "cmpf8dhf9000apgv81bj9cbpo",
    "name": "API AUDIT OFFICE HEAD 202605210830265585",
    "parentId": "cmpf8dhf70009pgv8xne2sw1m",
    "headId": "cmpf8dhdp0003pgv8dpqnjo8t",
    "status": "ACTIVE",
    "head": {
      "id": "cmpf8dhdp0003pgv8dpqnjo8t",
      "name": "API Audit office-head 202605210830265585",
      "email": "api.audit.202605210830265585.office-head@chmsu.edu.ph",
      "role": "OFFICE_HEAD"
    }
  }
]
```

### Offices - List director accessible offices

- Endpoint: GET /offices/accessible
- Expected: 200
- Actual: 200
- Outcome: passed
```json
[
  {
    "id": "cmpf8dhf70009pgv8xne2sw1m",
    "name": "API AUDIT DIRECTOR 202605210830265585",
    "parentId": "cmpf8dhf30008pgv8mtkyd1uo",
    "headId": "cmpf8dhdj0002pgv8dfi1chl6",
    "status": "ACTIVE",
    "head": {
      "id": "cmpf8dhdj0002pgv8dfi1chl6",
      "name": "API Audit director 202605210830265585",
      "email": "api.audit.202605210830265585.director@chmsu.edu.ph",
      "role": "DIRECTORS"
    }
  },
  {
    "id": "cmpf8dhf9000apgv81bj9cbpo",
    "name": "API AUDIT OFFICE HEAD 202605210830265585",
    "parentId": "cmpf8dhf70009pgv8xne2sw1m",
    "headId": "cmpf8dhdp0003pgv8dpqnjo8t",
    "status": "ACTIVE",
    "head": {
      "id": "cmpf8dhdp0003pgv8dpqnjo8t",
      "name": "API Audit office-head 202605210830265585",
      "email": "api.audit.202605210830265585.office-head@chmsu.edu.ph",
      "role": "OFFICE_HEAD"
    }
  }
]
```

### Plans - Create a draft RBAP plan

- Endpoint: POST /plans
- Expected: 201
- Actual: 201
- Outcome: passed
```json
{
  "id": "cmpf8di7g0001y8v8edk1hr5e",
  "officeId": "cmpf8dhf9000apgv81bj9cbpo",
  "planningYear": 2030,
  "campus": "Main Campus primary",
  "programProjectActivityKRA": "KRA primary 202605210830265585",
  "strategicAlignment": "Strategic Alignment primary 202605210830265585",
  "breakthroughGoals": "Breakthrough Goal primary 202605210830265585",
  "strategicObjectives": "Strategic Objective primary 202605210830265585",
  "datePrepared": "2030-01-15T00:00:00.000Z",
  "monitoringFrequency": "Quarterly",
  "reportingOffice": "Reporting Office primary 202605210830265585",
  "status": "DRAFT",
  "submittedAt": null,
  "approvedAt": null,
  "createdAt": "2026-05-21T08:30:28.204Z",
  "updatedAt": "2026-05-21T08:30:28.204Z",
  "office": {
    "id": "cmpf8dhf9000apgv81bj9cbpo",
    "name": "API AUDIT OFFICE HEAD 202605210830265585",
    "parentId": "cmpf8dhf70009pgv8xne2sw1m"
  },
  "createdBy": {
    "id": "cmpf8dhdp0003pgv8dpqnjo8t",
    "email": "api.audit.202605210830265585.office-head@chmsu.edu.ph",
    "name": "API Audit office-head 202605210830265585",
    "role": "OFFICE_HEAD"
  },
  "_count": {
    "goals": 0
  }
}
```

### Plans - List visible plans for the office head

- Endpoint: GET /plans?planningYear=2030&take=10&skip=0
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "data": [
    {
      "id": "cmpf8di7g0001y8v8edk1hr5e",
      "officeId": "cmpf8dhf9000apgv81bj9cbpo",
      "planningYear": 2030,
      "campus": "Main Campus primary",
      "programProjectActivityKRA": "KRA primary 202605210830265585",
      "strategicAlignment": "Strategic Alignment primary 202605210830265585",
      "breakthroughGoals": "Breakthrough Goal primary 202605210830265585",
      "strategicObjectives": "Strategic Objective primary 202605210830265585",
      "datePrepared": "2030-01-15T00:00:00.000Z",
      "monitoringFrequency": "Quarterly",
      "reportingOffice": "Reporting Office primary 202605210830265585",
      "status": "DRAFT",
      "submittedAt": null,
      "approvedAt": null,
      "createdAt": "2026-05-21T08:30:28.204Z",
      "updatedAt": "2026-05-21T08:30:28.204Z",
      "office": {
        "id": "cmpf8dhf9000apgv81bj9cbpo",
        "name": "API AUDIT OFFICE HEAD 202605210830265585",
        "parentId": "cmpf8dhf70009pgv8xne2sw1m"
      },
      "createdBy": {
        "id": "cmpf8dhdp0003pgv8dpqnjo8t",
        "email": "api.audit.202605210830265585.office-head@chmsu.edu.ph",
        "name": "API Audit office-head 202605210830265585",
        "rol...
```

### Plans - Get one plan

- Endpoint: GET /plans/cmpf8di7g0001y8v8edk1hr5e
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8di7g0001y8v8edk1hr5e",
  "officeId": "cmpf8dhf9000apgv81bj9cbpo",
  "planningYear": 2030,
  "campus": "Main Campus primary",
  "programProjectActivityKRA": "KRA primary 202605210830265585",
  "strategicAlignment": "Strategic Alignment primary 202605210830265585",
  "breakthroughGoals": "Breakthrough Goal primary 202605210830265585",
  "strategicObjectives": "Strategic Objective primary 202605210830265585",
  "datePrepared": "2030-01-15T00:00:00.000Z",
  "monitoringFrequency": "Quarterly",
  "reportingOffice": "Reporting Office primary 202605210830265585",
  "status": "DRAFT",
  "submittedAt": null,
  "approvedAt": null,
  "createdAt": "2026-05-21T08:30:28.204Z",
  "updatedAt": "2026-05-21T08:30:28.204Z",
  "office": {
    "id": "cmpf8dhf9000apgv81bj9cbpo",
    "name": "API AUDIT OFFICE HEAD 202605210830265585",
    "parentId": "cmpf8dhf70009pgv8xne2sw1m"
  },
  "createdBy": {
    "id": "cmpf8dhdp0003pgv8dpqnjo8t",
    "email": "api.audit.202605210830265585.office-head@chmsu.edu.ph",
    "name": "API Audit office-head 202605210830265585",
    "role": "OFFICE_HEAD"
  },
  "_count": {
    "goals": 0
  }
}
```

### Plans - Update a draft plan

- Endpoint: PATCH /plans/cmpf8di7g0001y8v8edk1hr5e
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8di7g0001y8v8edk1hr5e",
  "officeId": "cmpf8dhf9000apgv81bj9cbpo",
  "planningYear": 2030,
  "campus": "Main Campus primary",
  "programProjectActivityKRA": "KRA primary 202605210830265585",
  "strategicAlignment": "Strategic Alignment primary 202605210830265585",
  "breakthroughGoals": "Breakthrough Goal primary 202605210830265585",
  "strategicObjectives": "Strategic Objective primary 202605210830265585",
  "datePrepared": "2030-01-15T00:00:00.000Z",
  "monitoringFrequency": "Monthly",
  "reportingOffice": "RBAP Audit Reporting Office",
  "status": "DRAFT",
  "submittedAt": null,
  "approvedAt": null,
  "createdAt": "2026-05-21T08:30:28.204Z",
  "updatedAt": "2026-05-21T08:30:28.332Z",
  "office": {
    "id": "cmpf8dhf9000apgv81bj9cbpo",
    "name": "API AUDIT OFFICE HEAD 202605210830265585",
    "parentId": "cmpf8dhf70009pgv8xne2sw1m"
  },
  "createdBy": {
    "id": "cmpf8dhdp0003pgv8dpqnjo8t",
    "email": "api.audit.202605210830265585.office-head@chmsu.edu.ph",
    "name": "API Audit office-head 202605210830265585",
    "role": "OFFICE_HEAD"
  },
  "_count": {
    "goals": 0
  }
}
```

### Plans - Create a second draft plan for delete coverage

- Endpoint: POST /plans
- Expected: 201
- Actual: 201
- Outcome: passed
```json
{
  "id": "cmpf8dibj0002y8v8mp1gclvz",
  "officeId": "cmpf8dhf9000apgv81bj9cbpo",
  "planningYear": 2031,
  "campus": "Main Campus disposable",
  "programProjectActivityKRA": "KRA disposable 202605210830265585",
  "strategicAlignment": "Strategic Alignment disposable 202605210830265585",
  "breakthroughGoals": "Breakthrough Goal disposable 202605210830265585",
  "strategicObjectives": "Strategic Objective disposable 202605210830265585",
  "datePrepared": "2031-01-15T00:00:00.000Z",
  "monitoringFrequency": "Quarterly",
  "reportingOffice": "Reporting Office disposable 202605210830265585",
  "status": "DRAFT",
  "submittedAt": null,
  "approvedAt": null,
  "createdAt": "2026-05-21T08:30:28.351Z",
  "updatedAt": "2026-05-21T08:30:28.351Z",
  "office": {
    "id": "cmpf8dhf9000apgv81bj9cbpo",
    "name": "API AUDIT OFFICE HEAD 202605210830265585",
    "parentId": "cmpf8dhf70009pgv8xne2sw1m"
  },
  "createdBy": {
    "id": "cmpf8dhdp0003pgv8dpqnjo8t",
    "email": "api.audit.202605210830265585.office-head@chmsu.edu.ph",
    "name": "API Audit office-head 202605210830265585",
    "role": "OFFICE_HEAD"
  },
  "_count": {
    "goals": 0
  }
}
```

### Goals - Create a goal under the primary plan

- Endpoint: POST /plans/cmpf8di7g0001y8v8edk1hr5e/goals
- Expected: 201
- Actual: 201
- Outcome: passed
```json
{
  "id": "cmpf8dic10003y8v8ugr77wmj",
  "planId": "cmpf8di7g0001y8v8edk1hr5e",
  "officeId": "cmpf8dhf9000apgv81bj9cbpo",
  "resultLevel": "Result Level primary goal 202605210830265585",
  "targetResult": "Target Result primary goal 202605210830265585",
  "keyActions": "Key Actions primary goal 202605210830265585",
  "keyRisk": "Key Risk primary goal 202605210830265585",
  "mitigationMeasures": "Mitigation primary goal 202605210830265585",
  "keyPerformanceIndicator": "KPI primary goal 202605210830265585",
  "target": "Target primary goal 202605210830265585",
  "responsibleOfficePerson": "Responsible Person primary goal 202605210830265585",
  "timeline": "Timeline primary goal 202605210830265585",
  "fundSource": "Fund Source primary goal 202605210830265585",
  "budgetRequirements": "1000",
  "budgetAllocation": "750",
  "meansOfVerification": "MOV primary goal 202605210830265585",
  "status": "NOT_STARTED",
  "createdAt": "2026-05-21T08:30:28.369Z",
  "updatedAt": "2026-05-21T08:30:28.369Z",
  "office": {
    "id": "cmpf8dhf9000apgv81bj9cbpo",
    "name": "API AUDIT OFFICE HEAD 202605210830265585"
  },
  "plan": {
    "id": "cmpf8di7g0001y8v8edk1hr5e",
    "planningYear": 2030,
 ...
```

### Goals - Create a second goal for delete coverage

- Endpoint: POST /plans/cmpf8di7g0001y8v8edk1hr5e/goals
- Expected: 201
- Actual: 201
- Outcome: passed
```json
{
  "id": "cmpf8dicv0004y8v8cnryzati",
  "planId": "cmpf8di7g0001y8v8edk1hr5e",
  "officeId": "cmpf8dhf9000apgv81bj9cbpo",
  "resultLevel": "Result Level disposable goal 202605210830265585",
  "targetResult": "Target Result disposable goal 202605210830265585",
  "keyActions": "Key Actions disposable goal 202605210830265585",
  "keyRisk": "Key Risk disposable goal 202605210830265585",
  "mitigationMeasures": "Mitigation disposable goal 202605210830265585",
  "keyPerformanceIndicator": "KPI disposable goal 202605210830265585",
  "target": "Target disposable goal 202605210830265585",
  "responsibleOfficePerson": "Responsible Person disposable goal 202605210830265585",
  "timeline": "Timeline disposable goal 202605210830265585",
  "fundSource": "Fund Source disposable goal 202605210830265585",
  "budgetRequirements": "1000",
  "budgetAllocation": "750",
  "meansOfVerification": "MOV disposable goal 202605210830265585",
  "status": "NOT_STARTED",
  "createdAt": "2026-05-21T08:30:28.399Z",
  "updatedAt": "2026-05-21T08:30:28.399Z",
  "office": {
    "id": "cmpf8dhf9000apgv81bj9cbpo",
    "name": "API AUDIT OFFICE HEAD 202605210830265585"
  },
  "plan": {
    "id": "cmpf8di7g0001y8v8edk1h...
```

### Goals - List goals under a plan

- Endpoint: GET /plans/cmpf8di7g0001y8v8edk1hr5e/goals?take=10&skip=0
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "data": [
    {
      "id": "cmpf8dic10003y8v8ugr77wmj",
      "planId": "cmpf8di7g0001y8v8edk1hr5e",
      "officeId": "cmpf8dhf9000apgv81bj9cbpo",
      "resultLevel": "Result Level primary goal 202605210830265585",
      "targetResult": "Target Result primary goal 202605210830265585",
      "keyActions": "Key Actions primary goal 202605210830265585",
      "keyRisk": "Key Risk primary goal 202605210830265585",
      "mitigationMeasures": "Mitigation primary goal 202605210830265585",
      "keyPerformanceIndicator": "KPI primary goal 202605210830265585",
      "target": "Target primary goal 202605210830265585",
      "responsibleOfficePerson": "Responsible Person primary goal 202605210830265585",
      "timeline": "Timeline primary goal 202605210830265585",
      "fundSource": "Fund Source primary goal 202605210830265585",
      "budgetRequirements": "1000",
      "budgetAllocation": "750",
      "meansOfVerification": "MOV primary goal 202605210830265585",
      "status": "NOT_STARTED",
      "createdAt": "2026-05-21T08:30:28.369Z",
      "updatedAt": "2026-05-21T08:30:28.369Z",
      "office": {
        "id": "cmpf8dhf9000apgv81bj9cbpo",
        "name": "API AUDIT OFFICE HE...
```

### Goals - Get one goal under a plan

- Endpoint: GET /plans/cmpf8di7g0001y8v8edk1hr5e/goals/cmpf8dic10003y8v8ugr77wmj
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8dic10003y8v8ugr77wmj",
  "planId": "cmpf8di7g0001y8v8edk1hr5e",
  "officeId": "cmpf8dhf9000apgv81bj9cbpo",
  "resultLevel": "Result Level primary goal 202605210830265585",
  "targetResult": "Target Result primary goal 202605210830265585",
  "keyActions": "Key Actions primary goal 202605210830265585",
  "keyRisk": "Key Risk primary goal 202605210830265585",
  "mitigationMeasures": "Mitigation primary goal 202605210830265585",
  "keyPerformanceIndicator": "KPI primary goal 202605210830265585",
  "target": "Target primary goal 202605210830265585",
  "responsibleOfficePerson": "Responsible Person primary goal 202605210830265585",
  "timeline": "Timeline primary goal 202605210830265585",
  "fundSource": "Fund Source primary goal 202605210830265585",
  "budgetRequirements": "1000",
  "budgetAllocation": "750",
  "meansOfVerification": "MOV primary goal 202605210830265585",
  "status": "NOT_STARTED",
  "createdAt": "2026-05-21T08:30:28.369Z",
  "updatedAt": "2026-05-21T08:30:28.369Z",
  "office": {
    "id": "cmpf8dhf9000apgv81bj9cbpo",
    "name": "API AUDIT OFFICE HEAD 202605210830265585"
  },
  "plan": {
    "id": "cmpf8di7g0001y8v8edk1hr5e",
    "planningYear": 2030,
 ...
```

### Goals - Update a goal

- Endpoint: PATCH /plans/cmpf8di7g0001y8v8edk1hr5e/goals/cmpf8dic10003y8v8ugr77wmj
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8dic10003y8v8ugr77wmj",
  "planId": "cmpf8di7g0001y8v8edk1hr5e",
  "officeId": "cmpf8dhf9000apgv81bj9cbpo",
  "resultLevel": "Result Level primary goal 202605210830265585",
  "targetResult": "Target Result primary goal 202605210830265585",
  "keyActions": "Key Actions primary goal 202605210830265585",
  "keyRisk": "Key Risk primary goal 202605210830265585",
  "mitigationMeasures": "Mitigation primary goal 202605210830265585",
  "keyPerformanceIndicator": "KPI primary goal 202605210830265585",
  "target": "Target primary goal 202605210830265585",
  "responsibleOfficePerson": "Responsible Person primary goal 202605210830265585",
  "timeline": "Q2-Q4 2030",
  "fundSource": "Fund Source primary goal 202605210830265585",
  "budgetRequirements": "1000",
  "budgetAllocation": "750",
  "meansOfVerification": "MOV primary goal 202605210830265585",
  "status": "IN_PROGRESS",
  "createdAt": "2026-05-21T08:30:28.369Z",
  "updatedAt": "2026-05-21T08:30:28.484Z",
  "office": {
    "id": "cmpf8dhf9000apgv81bj9cbpo",
    "name": "API AUDIT OFFICE HEAD 202605210830265585"
  },
  "plan": {
    "id": "cmpf8di7g0001y8v8edk1hr5e",
    "planningYear": 2030,
    "status": "DRAFT"
  },
  "c...
```

### Goals - Browse goals without plan id

- Endpoint: GET /goals?planningYear=2030&planId=cmpf8di7g0001y8v8edk1hr5e&take=10&skip=0
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "data": [
    {
      "id": "cmpf8dic10003y8v8ugr77wmj",
      "planId": "cmpf8di7g0001y8v8edk1hr5e",
      "officeId": "cmpf8dhf9000apgv81bj9cbpo",
      "resultLevel": "Result Level primary goal 202605210830265585",
      "targetResult": "Target Result primary goal 202605210830265585",
      "keyActions": "Key Actions primary goal 202605210830265585",
      "keyRisk": "Key Risk primary goal 202605210830265585",
      "mitigationMeasures": "Mitigation primary goal 202605210830265585",
      "keyPerformanceIndicator": "KPI primary goal 202605210830265585",
      "target": "Target primary goal 202605210830265585",
      "responsibleOfficePerson": "Responsible Person primary goal 202605210830265585",
      "timeline": "Q2-Q4 2030",
      "fundSource": "Fund Source primary goal 202605210830265585",
      "budgetRequirements": "1000",
      "budgetAllocation": "750",
      "meansOfVerification": "MOV primary goal 202605210830265585",
      "status": "IN_PROGRESS",
      "createdAt": "2026-05-21T08:30:28.369Z",
      "updatedAt": "2026-05-21T08:30:28.484Z",
      "office": {
        "id": "cmpf8dhf9000apgv81bj9cbpo",
        "name": "API AUDIT OFFICE HEAD 202605210830265585"
      }...
```

### Goals - Get one goal without plan id

- Endpoint: GET /goals/cmpf8dic10003y8v8ugr77wmj
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8dic10003y8v8ugr77wmj",
  "planId": "cmpf8di7g0001y8v8edk1hr5e",
  "officeId": "cmpf8dhf9000apgv81bj9cbpo",
  "resultLevel": "Result Level primary goal 202605210830265585",
  "targetResult": "Target Result primary goal 202605210830265585",
  "keyActions": "Key Actions primary goal 202605210830265585",
  "keyRisk": "Key Risk primary goal 202605210830265585",
  "mitigationMeasures": "Mitigation primary goal 202605210830265585",
  "keyPerformanceIndicator": "KPI primary goal 202605210830265585",
  "target": "Target primary goal 202605210830265585",
  "responsibleOfficePerson": "Responsible Person primary goal 202605210830265585",
  "timeline": "Q2-Q4 2030",
  "fundSource": "Fund Source primary goal 202605210830265585",
  "budgetRequirements": "1000",
  "budgetAllocation": "750",
  "meansOfVerification": "MOV primary goal 202605210830265585",
  "status": "IN_PROGRESS",
  "createdAt": "2026-05-21T08:30:28.369Z",
  "updatedAt": "2026-05-21T08:30:28.484Z",
  "office": {
    "id": "cmpf8dhf9000apgv81bj9cbpo",
    "name": "API AUDIT OFFICE HEAD 202605210830265585"
  },
  "plan": {
    "id": "cmpf8di7g0001y8v8edk1hr5e",
    "planningYear": 2030,
    "status": "DRAFT"
  },
  "c...
```

### Objectives - Create an objective under the primary goal

- Endpoint: POST /plans/cmpf8di7g0001y8v8edk1hr5e/goals/cmpf8dic10003y8v8ugr77wmj/objectives
- Expected: 201
- Actual: 201
- Outcome: passed
```json
{
  "id": "cmpf8dign0005y8v8ys9d8tz8",
  "goalId": "cmpf8dic10003y8v8ugr77wmj",
  "resultLevel": "Result Level primary objective 202605210830265585",
  "targetResult": "Target Result primary objective 202605210830265585",
  "keyActions": "Key Actions primary objective 202605210830265585",
  "keyRisk": "Key Risk primary objective 202605210830265585",
  "mitigationMeasures": "Mitigation primary objective 202605210830265585",
  "keyPerformanceIndicator": "KPI primary objective 202605210830265585",
  "target": "Target primary objective 202605210830265585",
  "responsibleOfficePerson": "Responsible Person primary objective 202605210830265585",
  "timeline": "Timeline primary objective 202605210830265585",
  "fundSource": "Fund Source primary objective 202605210830265585",
  "budgetRequirements": "1000",
  "budgetAllocation": "750",
  "meansOfVerification": "MOV primary objective 202605210830265585",
  "status": "NOT_STARTED",
  "createdAt": "2026-05-21T08:30:28.535Z",
  "updatedAt": "2026-05-21T08:30:28.535Z",
  "goal": {
    "id": "cmpf8dic10003y8v8ugr77wmj",
    "planId": "cmpf8di7g0001y8v8edk1hr5e",
    "resultLevel": "Result Level primary goal 202605210830265585",
    "office": {
  ...
```

### Objectives - Create a second objective for delete coverage

- Endpoint: POST /plans/cmpf8di7g0001y8v8edk1hr5e/goals/cmpf8dic10003y8v8ugr77wmj/objectives
- Expected: 201
- Actual: 201
- Outcome: passed
```json
{
  "id": "cmpf8dih10006y8v8xj3uhdgd",
  "goalId": "cmpf8dic10003y8v8ugr77wmj",
  "resultLevel": "Result Level disposable objective 202605210830265585",
  "targetResult": "Target Result disposable objective 202605210830265585",
  "keyActions": "Key Actions disposable objective 202605210830265585",
  "keyRisk": "Key Risk disposable objective 202605210830265585",
  "mitigationMeasures": "Mitigation disposable objective 202605210830265585",
  "keyPerformanceIndicator": "KPI disposable objective 202605210830265585",
  "target": "Target disposable objective 202605210830265585",
  "responsibleOfficePerson": "Responsible Person disposable objective 202605210830265585",
  "timeline": "Timeline disposable objective 202605210830265585",
  "fundSource": "Fund Source disposable objective 202605210830265585",
  "budgetRequirements": "1000",
  "budgetAllocation": "750",
  "meansOfVerification": "MOV disposable objective 202605210830265585",
  "status": "NOT_STARTED",
  "createdAt": "2026-05-21T08:30:28.549Z",
  "updatedAt": "2026-05-21T08:30:28.549Z",
  "goal": {
    "id": "cmpf8dic10003y8v8ugr77wmj",
    "planId": "cmpf8di7g0001y8v8edk1hr5e",
    "resultLevel": "Result Level primary goal 202605...
```

### Objectives - List objectives under a goal

- Endpoint: GET /plans/cmpf8di7g0001y8v8edk1hr5e/goals/cmpf8dic10003y8v8ugr77wmj/objectives?take=10&skip=0
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "data": [
    {
      "id": "cmpf8dign0005y8v8ys9d8tz8",
      "goalId": "cmpf8dic10003y8v8ugr77wmj",
      "resultLevel": "Result Level primary objective 202605210830265585",
      "targetResult": "Target Result primary objective 202605210830265585",
      "keyActions": "Key Actions primary objective 202605210830265585",
      "keyRisk": "Key Risk primary objective 202605210830265585",
      "mitigationMeasures": "Mitigation primary objective 202605210830265585",
      "keyPerformanceIndicator": "KPI primary objective 202605210830265585",
      "target": "Target primary objective 202605210830265585",
      "responsibleOfficePerson": "Responsible Person primary objective 202605210830265585",
      "timeline": "Timeline primary objective 202605210830265585",
      "fundSource": "Fund Source primary objective 202605210830265585",
      "budgetRequirements": "1000",
      "budgetAllocation": "750",
      "meansOfVerification": "MOV primary objective 202605210830265585",
      "status": "NOT_STARTED",
      "createdAt": "2026-05-21T08:30:28.535Z",
      "updatedAt": "2026-05-21T08:30:28.535Z",
      "goal": {
        "id": "cmpf8dic10003y8v8ugr77wmj",
        "planId": "cmpf8di7g00...
```

### Objectives - Get one objective under a goal

- Endpoint: GET /plans/cmpf8di7g0001y8v8edk1hr5e/goals/cmpf8dic10003y8v8ugr77wmj/objectives/cmpf8dign0005y8v8ys9d8tz8
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8dign0005y8v8ys9d8tz8",
  "goalId": "cmpf8dic10003y8v8ugr77wmj",
  "resultLevel": "Result Level primary objective 202605210830265585",
  "targetResult": "Target Result primary objective 202605210830265585",
  "keyActions": "Key Actions primary objective 202605210830265585",
  "keyRisk": "Key Risk primary objective 202605210830265585",
  "mitigationMeasures": "Mitigation primary objective 202605210830265585",
  "keyPerformanceIndicator": "KPI primary objective 202605210830265585",
  "target": "Target primary objective 202605210830265585",
  "responsibleOfficePerson": "Responsible Person primary objective 202605210830265585",
  "timeline": "Timeline primary objective 202605210830265585",
  "fundSource": "Fund Source primary objective 202605210830265585",
  "budgetRequirements": "1000",
  "budgetAllocation": "750",
  "meansOfVerification": "MOV primary objective 202605210830265585",
  "status": "NOT_STARTED",
  "createdAt": "2026-05-21T08:30:28.535Z",
  "updatedAt": "2026-05-21T08:30:28.535Z",
  "goal": {
    "id": "cmpf8dic10003y8v8ugr77wmj",
    "planId": "cmpf8di7g0001y8v8edk1hr5e",
    "resultLevel": "Result Level primary goal 202605210830265585",
    "office": {
  ...
```

### Objectives - Update an objective

- Endpoint: PATCH /plans/cmpf8di7g0001y8v8edk1hr5e/goals/cmpf8dic10003y8v8ugr77wmj/objectives/cmpf8dign0005y8v8ys9d8tz8
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8dign0005y8v8ys9d8tz8",
  "goalId": "cmpf8dic10003y8v8ugr77wmj",
  "resultLevel": "Result Level primary objective 202605210830265585",
  "targetResult": "Target Result primary objective 202605210830265585",
  "keyActions": "Key Actions primary objective 202605210830265585",
  "keyRisk": "Key Risk primary objective 202605210830265585",
  "mitigationMeasures": "Mitigation primary objective 202605210830265585",
  "keyPerformanceIndicator": "KPI primary objective 202605210830265585",
  "target": "Target primary objective 202605210830265585",
  "responsibleOfficePerson": "Responsible Person primary objective 202605210830265585",
  "timeline": "Q4 2030",
  "fundSource": "Fund Source primary objective 202605210830265585",
  "budgetRequirements": "1000",
  "budgetAllocation": "750",
  "meansOfVerification": "MOV primary objective 202605210830265585",
  "status": "COMPLETED",
  "createdAt": "2026-05-21T08:30:28.535Z",
  "updatedAt": "2026-05-21T08:30:28.586Z",
  "goal": {
    "id": "cmpf8dic10003y8v8ugr77wmj",
    "planId": "cmpf8di7g0001y8v8edk1hr5e",
    "resultLevel": "Result Level primary goal 202605210830265585",
    "office": {
      "id": "cmpf8dhf9000apgv81bj9cbpo",
 ...
```

### Objectives - Browse objectives without goal id

- Endpoint: GET /objectives?planningYear=2030&goalId=cmpf8dic10003y8v8ugr77wmj&take=10&skip=0
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "data": [
    {
      "id": "cmpf8dign0005y8v8ys9d8tz8",
      "goalId": "cmpf8dic10003y8v8ugr77wmj",
      "resultLevel": "Result Level primary objective 202605210830265585",
      "targetResult": "Target Result primary objective 202605210830265585",
      "keyActions": "Key Actions primary objective 202605210830265585",
      "keyRisk": "Key Risk primary objective 202605210830265585",
      "mitigationMeasures": "Mitigation primary objective 202605210830265585",
      "keyPerformanceIndicator": "KPI primary objective 202605210830265585",
      "target": "Target primary objective 202605210830265585",
      "responsibleOfficePerson": "Responsible Person primary objective 202605210830265585",
      "timeline": "Q4 2030",
      "fundSource": "Fund Source primary objective 202605210830265585",
      "budgetRequirements": "1000",
      "budgetAllocation": "750",
      "meansOfVerification": "MOV primary objective 202605210830265585",
      "status": "COMPLETED",
      "createdAt": "2026-05-21T08:30:28.535Z",
      "updatedAt": "2026-05-21T08:30:28.586Z",
      "goal": {
        "id": "cmpf8dic10003y8v8ugr77wmj",
        "planId": "cmpf8di7g0001y8v8edk1hr5e",
        "resultLevel": ...
```

### Objectives - Get one objective without goal id

- Endpoint: GET /objectives/cmpf8dign0005y8v8ys9d8tz8
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8dign0005y8v8ys9d8tz8",
  "goalId": "cmpf8dic10003y8v8ugr77wmj",
  "resultLevel": "Result Level primary objective 202605210830265585",
  "targetResult": "Target Result primary objective 202605210830265585",
  "keyActions": "Key Actions primary objective 202605210830265585",
  "keyRisk": "Key Risk primary objective 202605210830265585",
  "mitigationMeasures": "Mitigation primary objective 202605210830265585",
  "keyPerformanceIndicator": "KPI primary objective 202605210830265585",
  "target": "Target primary objective 202605210830265585",
  "responsibleOfficePerson": "Responsible Person primary objective 202605210830265585",
  "timeline": "Q4 2030",
  "fundSource": "Fund Source primary objective 202605210830265585",
  "budgetRequirements": "1000",
  "budgetAllocation": "750",
  "meansOfVerification": "MOV primary objective 202605210830265585",
  "status": "COMPLETED",
  "createdAt": "2026-05-21T08:30:28.535Z",
  "updatedAt": "2026-05-21T08:30:28.586Z",
  "goal": {
    "id": "cmpf8dic10003y8v8ugr77wmj",
    "planId": "cmpf8di7g0001y8v8edk1hr5e",
    "resultLevel": "Result Level primary goal 202605210830265585",
    "office": {
      "id": "cmpf8dhf9000apgv81bj9cbpo",
 ...
```

### Objectives - Delete the disposable objective

- Endpoint: DELETE /plans/cmpf8di7g0001y8v8edk1hr5e/goals/cmpf8dic10003y8v8ugr77wmj/objectives/cmpf8dih10006y8v8xj3uhdgd
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8dih10006y8v8xj3uhdgd",
  "goalId": "cmpf8dic10003y8v8ugr77wmj",
  "resultLevel": "Result Level disposable objective 202605210830265585",
  "targetResult": "Target Result disposable objective 202605210830265585",
  "keyActions": "Key Actions disposable objective 202605210830265585",
  "keyRisk": "Key Risk disposable objective 202605210830265585",
  "mitigationMeasures": "Mitigation disposable objective 202605210830265585",
  "keyPerformanceIndicator": "KPI disposable objective 202605210830265585",
  "target": "Target disposable objective 202605210830265585",
  "responsibleOfficePerson": "Responsible Person disposable objective 202605210830265585",
  "timeline": "Timeline disposable objective 202605210830265585",
  "fundSource": "Fund Source disposable objective 202605210830265585",
  "budgetRequirements": "1000",
  "budgetAllocation": "750",
  "meansOfVerification": "MOV disposable objective 202605210830265585",
  "status": "NOT_STARTED",
  "createdAt": "2026-05-21T08:30:28.549Z",
  "updatedAt": "2026-05-21T08:30:28.549Z",
  "goal": {
    "id": "cmpf8dic10003y8v8ugr77wmj",
    "planId": "cmpf8di7g0001y8v8edk1hr5e",
    "resultLevel": "Result Level primary goal 202605...
```

### Goals - Delete the disposable goal

- Endpoint: DELETE /plans/cmpf8di7g0001y8v8edk1hr5e/goals/cmpf8dicv0004y8v8cnryzati
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8dicv0004y8v8cnryzati",
  "planId": "cmpf8di7g0001y8v8edk1hr5e",
  "officeId": "cmpf8dhf9000apgv81bj9cbpo",
  "resultLevel": "Result Level disposable goal 202605210830265585",
  "targetResult": "Target Result disposable goal 202605210830265585",
  "keyActions": "Key Actions disposable goal 202605210830265585",
  "keyRisk": "Key Risk disposable goal 202605210830265585",
  "mitigationMeasures": "Mitigation disposable goal 202605210830265585",
  "keyPerformanceIndicator": "KPI disposable goal 202605210830265585",
  "target": "Target disposable goal 202605210830265585",
  "responsibleOfficePerson": "Responsible Person disposable goal 202605210830265585",
  "timeline": "Timeline disposable goal 202605210830265585",
  "fundSource": "Fund Source disposable goal 202605210830265585",
  "budgetRequirements": "1000",
  "budgetAllocation": "750",
  "meansOfVerification": "MOV disposable goal 202605210830265585",
  "status": "NOT_STARTED",
  "createdAt": "2026-05-21T08:30:28.399Z",
  "updatedAt": "2026-05-21T08:30:28.399Z",
  "office": {
    "id": "cmpf8dhf9000apgv81bj9cbpo",
    "name": "API AUDIT OFFICE HEAD 202605210830265585"
  },
  "plan": {
    "id": "cmpf8di7g0001y8v8edk1h...
```

### Plans - Get plan summary for a director view

- Endpoint: GET /plans/summary?officeId=cmpf8dhf9000apgv81bj9cbpo&planningYear=2030
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "filters": {
    "officeId": "cmpf8dhf9000apgv81bj9cbpo",
    "planningYear": 2030
  },
  "overview": {
    "totalPlans": 1,
    "draftPlans": 1,
    "submittedPlans": 0,
    "approvedPlans": 0,
    "pendingApprovalCount": 0
  },
  "byOffice": [
    {
      "officeId": "cmpf8dhf9000apgv81bj9cbpo",
      "officeName": "API AUDIT OFFICE HEAD 202605210830265585",
      "totalPlans": 1,
      "draftPlans": 1,
      "submittedPlans": 0,
      "approvedPlans": 0
    }
  ],
  "byYear": [
    {
      "planningYear": 2030,
      "totalPlans": 1,
      "draftPlans": 1,
      "submittedPlans": 0,
      "approvedPlans": 0
    }
  ]
}
```

### Plans - Delete the disposable draft plan

- Endpoint: DELETE /plans/cmpf8dibj0002y8v8mp1gclvz
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8dibj0002y8v8mp1gclvz",
  "officeId": "cmpf8dhf9000apgv81bj9cbpo",
  "planningYear": 2031,
  "campus": "Main Campus disposable",
  "programProjectActivityKRA": "KRA disposable 202605210830265585",
  "strategicAlignment": "Strategic Alignment disposable 202605210830265585",
  "breakthroughGoals": "Breakthrough Goal disposable 202605210830265585",
  "strategicObjectives": "Strategic Objective disposable 202605210830265585",
  "datePrepared": "2031-01-15T00:00:00.000Z",
  "monitoringFrequency": "Quarterly",
  "reportingOffice": "Reporting Office disposable 202605210830265585",
  "status": "DRAFT",
  "submittedAt": null,
  "approvedAt": null,
  "createdAt": "2026-05-21T08:30:28.351Z",
  "updatedAt": "2026-05-21T08:30:28.351Z",
  "office": {
    "id": "cmpf8dhf9000apgv81bj9cbpo",
    "name": "API AUDIT OFFICE HEAD 202605210830265585",
    "parentId": "cmpf8dhf70009pgv8xne2sw1m"
  },
  "createdBy": {
    "id": "cmpf8dhdp0003pgv8dpqnjo8t",
    "email": "api.audit.202605210830265585.office-head@chmsu.edu.ph",
    "name": "API Audit office-head 202605210830265585",
    "role": "OFFICE_HEAD"
  },
  "_count": {
    "goals": 0
  }
}
```

### Plans - Submit the primary plan

- Endpoint: PATCH /plans/cmpf8di7g0001y8v8edk1hr5e/submit
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8di7g0001y8v8edk1hr5e",
  "officeId": "cmpf8dhf9000apgv81bj9cbpo",
  "planningYear": 2030,
  "campus": "Main Campus primary",
  "programProjectActivityKRA": "KRA primary 202605210830265585",
  "strategicAlignment": "Strategic Alignment primary 202605210830265585",
  "breakthroughGoals": "Breakthrough Goal primary 202605210830265585",
  "strategicObjectives": "Strategic Objective primary 202605210830265585",
  "datePrepared": "2030-01-15T00:00:00.000Z",
  "monitoringFrequency": "Monthly",
  "reportingOffice": "RBAP Audit Reporting Office",
  "status": "SUBMITTED",
  "submittedAt": "2026-05-21T08:30:28.681Z",
  "approvedAt": null,
  "createdAt": "2026-05-21T08:30:28.204Z",
  "updatedAt": "2026-05-21T08:30:28.684Z",
  "office": {
    "id": "cmpf8dhf9000apgv81bj9cbpo",
    "name": "API AUDIT OFFICE HEAD 202605210830265585",
    "parentId": "cmpf8dhf70009pgv8xne2sw1m"
  },
  "createdBy": {
    "id": "cmpf8dhdp0003pgv8dpqnjo8t",
    "email": "api.audit.202605210830265585.office-head@chmsu.edu.ph",
    "name": "API Audit office-head 202605210830265585",
    "role": "OFFICE_HEAD"
  },
  "_count": {
    "goals": 1
  }
}
```

### Plans - Policy check: block updates after submission

- Endpoint: PATCH /plans/cmpf8di7g0001y8v8edk1hr5e
- Expected: 403
- Actual: 403
- Outcome: passed
```json
{
  "statusCode": 403,
  "timestamp": "2026-05-21T08:30:28.697Z",
  "path": "/api/v1/plans/cmpf8di7g0001y8v8edk1hr5e",
  "message": "Only draft plans can be edited or deleted by the owning office."
}
```

### Plans - List pending approvals for the director

- Endpoint: GET /plans/pending-approvals?planningYear=2030&take=10&skip=0
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "data": [
    {
      "id": "cmpf8di7g0001y8v8edk1hr5e",
      "officeId": "cmpf8dhf9000apgv81bj9cbpo",
      "planningYear": 2030,
      "campus": "Main Campus primary",
      "programProjectActivityKRA": "KRA primary 202605210830265585",
      "strategicAlignment": "Strategic Alignment primary 202605210830265585",
      "breakthroughGoals": "Breakthrough Goal primary 202605210830265585",
      "strategicObjectives": "Strategic Objective primary 202605210830265585",
      "datePrepared": "2030-01-15T00:00:00.000Z",
      "monitoringFrequency": "Monthly",
      "reportingOffice": "RBAP Audit Reporting Office",
      "status": "SUBMITTED",
      "submittedAt": "2026-05-21T08:30:28.681Z",
      "approvedAt": null,
      "createdAt": "2026-05-21T08:30:28.204Z",
      "updatedAt": "2026-05-21T08:30:28.684Z",
      "office": {
        "id": "cmpf8dhf9000apgv81bj9cbpo",
        "name": "API AUDIT OFFICE HEAD 202605210830265585",
        "parentId": "cmpf8dhf70009pgv8xne2sw1m"
      },
      "createdBy": {
        "id": "cmpf8dhdp0003pgv8dpqnjo8t",
        "email": "api.audit.202605210830265585.office-head@chmsu.edu.ph",
        "name": "API Audit office-head 202605210830265585",
    ...
```

### Plans - Approve the submitted plan as director

- Endpoint: PATCH /plans/cmpf8di7g0001y8v8edk1hr5e/approve
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "id": "cmpf8di7g0001y8v8edk1hr5e",
  "officeId": "cmpf8dhf9000apgv81bj9cbpo",
  "planningYear": 2030,
  "campus": "Main Campus primary",
  "programProjectActivityKRA": "KRA primary 202605210830265585",
  "strategicAlignment": "Strategic Alignment primary 202605210830265585",
  "breakthroughGoals": "Breakthrough Goal primary 202605210830265585",
  "strategicObjectives": "Strategic Objective primary 202605210830265585",
  "datePrepared": "2030-01-15T00:00:00.000Z",
  "monitoringFrequency": "Monthly",
  "reportingOffice": "RBAP Audit Reporting Office",
  "status": "APPROVED",
  "submittedAt": "2026-05-21T08:30:28.681Z",
  "approvedAt": "2026-05-21T08:30:28.719Z",
  "createdAt": "2026-05-21T08:30:28.204Z",
  "updatedAt": "2026-05-21T08:30:28.720Z",
  "office": {
    "id": "cmpf8dhf9000apgv81bj9cbpo",
    "name": "API AUDIT OFFICE HEAD 202605210830265585",
    "parentId": "cmpf8dhf70009pgv8xne2sw1m"
  },
  "createdBy": {
    "id": "cmpf8dhdp0003pgv8dpqnjo8t",
    "email": "api.audit.202605210830265585.office-head@chmsu.edu.ph",
    "name": "API Audit office-head 202605210830265585",
    "role": "OFFICE_HEAD"
  },
  "_count": {
    "goals": 1
  }
}
```

### Plans - List visible plans for the director

- Endpoint: GET /plans?officeId=cmpf8dhf9000apgv81bj9cbpo&planningYear=2030&take=10&skip=0
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "data": [
    {
      "id": "cmpf8di7g0001y8v8edk1hr5e",
      "officeId": "cmpf8dhf9000apgv81bj9cbpo",
      "planningYear": 2030,
      "campus": "Main Campus primary",
      "programProjectActivityKRA": "KRA primary 202605210830265585",
      "strategicAlignment": "Strategic Alignment primary 202605210830265585",
      "breakthroughGoals": "Breakthrough Goal primary 202605210830265585",
      "strategicObjectives": "Strategic Objective primary 202605210830265585",
      "datePrepared": "2030-01-15T00:00:00.000Z",
      "monitoringFrequency": "Monthly",
      "reportingOffice": "RBAP Audit Reporting Office",
      "status": "APPROVED",
      "submittedAt": "2026-05-21T08:30:28.681Z",
      "approvedAt": "2026-05-21T08:30:28.719Z",
      "createdAt": "2026-05-21T08:30:28.204Z",
      "updatedAt": "2026-05-21T08:30:28.720Z",
      "office": {
        "id": "cmpf8dhf9000apgv81bj9cbpo",
        "name": "API AUDIT OFFICE HEAD 202605210830265585",
        "parentId": "cmpf8dhf70009pgv8xne2sw1m"
      },
      "createdBy": {
        "id": "cmpf8dhdp0003pgv8dpqnjo8t",
        "email": "api.audit.202605210830265585.office-head@chmsu.edu.ph",
        "name": "API Audit office-head 2026...
```

### Plans - Get summary after approval

- Endpoint: GET /plans/summary?planningYear=2030
- Expected: 200
- Actual: 200
- Outcome: passed
```json
{
  "filters": {
    "officeId": null,
    "planningYear": 2030
  },
  "overview": {
    "totalPlans": 1,
    "draftPlans": 0,
    "submittedPlans": 0,
    "approvedPlans": 1,
    "pendingApprovalCount": 0
  },
  "byOffice": [
    {
      "officeId": "cmpf8dhf9000apgv81bj9cbpo",
      "officeName": "API AUDIT OFFICE HEAD 202605210830265585",
      "totalPlans": 1,
      "draftPlans": 0,
      "submittedPlans": 0,
      "approvedPlans": 1
    }
  ],
  "byYear": [
    {
      "planningYear": 2030,
      "totalPlans": 1,
      "draftPlans": 0,
      "submittedPlans": 0,
      "approvedPlans": 1
    }
  ]
}
```
