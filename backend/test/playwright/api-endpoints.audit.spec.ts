import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  APIRequestContext,
  APIResponse,
  expect,
  request,
  test,
} from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

type StepCategory = 'happy-path' | 'policy-check' | 'known-issue';
type StepOutcome = 'passed' | 'failed' | 'skipped';

type StepRecord = {
  category: StepCategory;
  module: string;
  name: string;
  method: string;
  path: string;
  expectedStatus: string;
  actualStatus: number | null;
  outcome: StepOutcome;
  note?: string;
  responsePreview?: string;
};

type StepExecutionResult<T> = {
  ok: boolean;
  actualStatus: number | null;
  payload: T | string | null;
};

type AuthSession = {
  email: string;
  accessToken: string;
  refreshToken: string;
};

type FixtureUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  officeId: string | null;
  status: string;
};

type FixtureOffice = {
  id: string;
  name: string;
  parentId: string | null;
  headId: string | null;
  status: string;
};

type SeededFixtures = {
  runTag: string;
  users: {
    president: FixtureUser;
    vicePresident: FixtureUser;
    director: FixtureUser;
    officeHead: FixtureUser;
    unassigned: FixtureUser;
    assignable: FixtureUser;
    newOfficeHead: FixtureUser;
  };
  offices: {
    president: FixtureOffice;
    vicePresident: FixtureOffice;
    director: FixtureOffice;
    officeHead: FixtureOffice;
  };
};

type CreatedRecords = {
  offices: string[];
  plans: string[];
  goals: string[];
  objectives: string[];
};

type DatabaseSnapshot = {
  users: Array<Record<string, unknown>>;
  offices: Array<Record<string, unknown>>;
  plans: Array<Record<string, unknown>>;
  goals: Array<Record<string, unknown>>;
  objectives: Array<Record<string, unknown>>;
};

const configuredBaseUrl =
  process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';
const baseURL = configuredBaseUrl.endsWith('/')
  ? configuredBaseUrl
  : `${configuredBaseUrl}/`;
const adminEmail = process.env.API_ADMIN_EMAIL ?? 'mark.meguizo@chmsu.edu.ph';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for the Playwright API audit.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

test.describe.configure({ mode: 'serial' });

test('audit implemented API endpoints and document inserted data', async () => {
  const runTag = buildRunTag();
  const steps: StepRecord[] = [];
  const createdRecords: CreatedRecords = {
    offices: [],
    plans: [],
    goals: [],
    objectives: [],
  };

  let api: APIRequestContext | null = null;
  let fixtures: SeededFixtures | null = null;
  let snapshot: DatabaseSnapshot = {
    users: [],
    offices: [],
    plans: [],
    goals: [],
    objectives: [],
  };

  try {
    fixtures = await seedFixtures(runTag);
    api = await request.newContext({
      baseURL,
      extraHTTPHeaders: {
        Accept: 'application/json',
      },
    });

    const admin = await loginViaDevEndpoint(
      api,
      steps,
      adminEmail,
      'ADMIN bootstrap',
    );
    const officeHead = fixtures
      ? await loginViaDevEndpoint(
          api,
          steps,
          fixtures.users.officeHead.email,
          'OFFICE_HEAD fixture',
        )
      : null;
    const director = fixtures
      ? await loginViaDevEndpoint(
          api,
          steps,
          fixtures.users.director.email,
          'DIRECTOR fixture',
        )
      : null;

    if (admin) {
      await auditAuth(api, steps, admin, fixtures?.users.officeHead.email);
      if (fixtures) {
        await auditUsers(api, steps, admin, fixtures);
        await auditOffices(api, steps, admin, fixtures, createdRecords);
      }
    } else {
      recordSkip(
        steps,
        'happy-path',
        'Auth',
        'Admin-dependent endpoints',
        'POST/GET',
        '/auth /user /offices',
        'Admin login did not succeed, so dependent endpoint checks were skipped.',
      );
    }

    if (fixtures && officeHead && director) {
      await auditRbap(
        api,
        steps,
        officeHead,
        director,
        fixtures,
        createdRecords,
      );
    } else {
      recordSkip(
        steps,
        'happy-path',
        'RBAP',
        'Plan, goal, and objective lifecycle',
        'POST/GET/PATCH/DELETE',
        '/plans /goals /objectives',
        'Fixture users were not fully available, so RBAP lifecycle checks were skipped.',
      );
    }
  } finally {
    snapshot = await buildDatabaseSnapshot(fixtures, createdRecords);
    writeAuditFiles({
      runTag,
      steps,
      fixtures,
      createdRecords,
      snapshot,
      baseURL,
    });
    await api?.dispose();
    await prisma.$disconnect();
  }

  const unexpectedFailures = steps.filter(
    (step) => step.outcome === 'failed' && step.category !== 'known-issue',
  );

  expect(
    unexpectedFailures,
    formatUnexpectedFailures(unexpectedFailures),
  ).toEqual([]);
});

async function auditAuth(
  api: APIRequestContext,
  steps: StepRecord[],
  admin: AuthSession,
  officeHeadEmail?: string,
) {
  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Auth',
    name: 'Get authenticated admin profile',
    method: 'GET',
    path: '/auth/me',
    expectedStatuses: [200],
    headers: authHeaders(admin),
  });

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Auth',
    name: 'Refresh admin tokens',
    method: 'POST',
    path: '/auth/refresh',
    expectedStatuses: [200],
    data: { refresh_token: admin.refreshToken },
  });

  if (officeHeadEmail) {
    const officeHeadLogin = await loginViaDevEndpoint(
      api,
      steps,
      officeHeadEmail,
      'OFFICE_HEAD auth/me check',
    );

    if (!officeHeadLogin) {
      recordSkip(
        steps,
        'happy-path',
        'Auth',
        'Get authenticated office head profile',
        'GET',
        '/auth/me',
        'Office head login failed, so the profile check was skipped.',
      );
      return;
    }

    await callStep<Record<string, unknown>>({
      api,
      steps,
      category: 'happy-path',
      module: 'Auth',
      name: 'Get authenticated office head profile',
      method: 'GET',
      path: '/auth/me',
      expectedStatuses: [200],
      headers: authHeaders(officeHeadLogin),
    });
  }
}

async function auditUsers(
  api: APIRequestContext,
  steps: StepRecord[],
  admin: AuthSession,
  fixtures: SeededFixtures,
) {
  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Users',
    name: 'List users',
    method: 'GET',
    path: '/user?take=20&skip=0',
    expectedStatuses: [200],
    headers: authHeaders(admin),
  });

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Users',
    name: 'List users without office',
    method: 'GET',
    path: '/user/without-office',
    expectedStatuses: [200],
    headers: authHeaders(admin),
  });

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Users',
    name: 'Get user by id',
    method: 'GET',
    path: `/user/user-id?userId=${fixtures.users.officeHead.id}`,
    expectedStatuses: [200],
    headers: authHeaders(admin),
  });

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Users',
    name: 'Get user by email',
    method: 'GET',
    path: `/user/user-email?email=${encodeURIComponent(fixtures.users.officeHead.email)}`,
    expectedStatuses: [200],
    headers: authHeaders(admin),
  });

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Users',
    name: 'Change a user role',
    method: 'POST',
    path: '/user/assign-role',
    expectedStatuses: [200],
    headers: authHeaders(admin),
    data: {
      userId: fixtures.users.assignable.id,
      role: 'DIRECTORS',
    },
  });

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Users',
    name: 'Assign a user to an office',
    method: 'POST',
    path: '/user/assign-office',
    expectedStatuses: [200],
    headers: authHeaders(admin),
    data: {
      userId: fixtures.users.assignable.id,
      officeId: fixtures.offices.officeHead.id,
    },
  });

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Users',
    name: 'Toggle a user status',
    method: 'POST',
    path: '/user/change-user-status',
    expectedStatuses: [200],
    headers: authHeaders(admin),
    data: {
      userId: fixtures.users.assignable.id,
    },
  });

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'known-issue',
    module: 'Users',
    name: 'Known issue check: missing userId query param',
    method: 'GET',
    path: '/user/user-id',
    expectedStatuses: [400],
    headers: authHeaders(admin),
  });
}

async function auditOffices(
  api: APIRequestContext,
  steps: StepRecord[],
  admin: AuthSession,
  fixtures: SeededFixtures,
  createdRecords: CreatedRecords,
) {
  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Offices',
    name: 'List active offices',
    method: 'GET',
    path: '/offices?take=20&skip=0',
    expectedStatuses: [200],
    headers: authHeaders(admin),
  });

  const addedOffice = await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Offices',
    name: 'Create a temporary office',
    method: 'POST',
    path: '/offices/add-office',
    expectedStatuses: [201],
    headers: authHeaders(admin),
    data: {
      name: `API AUDIT TEMP OFFICE ${fixtures.runTag}`,
      userId: fixtures.users.newOfficeHead.id,
      parentId: fixtures.offices.director.id,
    },
  });

  const addedOfficeId = extractId(addedOffice.payload);

  if (!addedOffice.ok || !addedOfficeId) {
    recordSkip(
      steps,
      'happy-path',
      'Offices',
      'Update the temporary office',
      'PATCH',
      '/offices/update-office',
      'The temporary office was not created, so update/delete checks were skipped.',
    );
    recordSkip(
      steps,
      'happy-path',
      'Offices',
      'Delete the temporary office',
      'POST',
      '/offices/delete-office',
      'The temporary office was not created, so update/delete checks were skipped.',
    );
    return;
  }

  createdRecords.offices.push(addedOfficeId);

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Offices',
    name: 'Update the temporary office',
    method: 'PATCH',
    path: '/offices/update-office',
    expectedStatuses: [200],
    headers: authHeaders(admin),
    data: {
      officeId: addedOfficeId,
      name: `API AUDIT TEMP OFFICE RENAMED ${fixtures.runTag}`,
      parentId: fixtures.offices.president.id,
      userId: fixtures.users.newOfficeHead.id,
    },
  });

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Offices',
    name: 'Delete the temporary office',
    method: 'POST',
    path: '/offices/delete-office',
    expectedStatuses: [200],
    headers: authHeaders(admin),
    data: {
      officeId: addedOfficeId,
    },
  });
}

async function auditRbap(
  api: APIRequestContext,
  steps: StepRecord[],
  officeHead: AuthSession,
  director: AuthSession,
  fixtures: SeededFixtures,
  createdRecords: CreatedRecords,
) {
  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Offices',
    name: 'List office head accessible offices',
    method: 'GET',
    path: '/offices/accessible',
    expectedStatuses: [200],
    headers: authHeaders(officeHead),
  });

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Offices',
    name: 'List director accessible offices',
    method: 'GET',
    path: '/offices/accessible',
    expectedStatuses: [200],
    headers: authHeaders(director),
  });

  const primaryPlan = await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Plans',
    name: 'Create a draft RBAP plan',
    method: 'POST',
    path: '/plans',
    expectedStatuses: [201],
    headers: authHeaders(officeHead),
    data: buildPlanPayload(fixtures.runTag, 'primary', 2030),
  });

  const primaryPlanId = extractId(primaryPlan.payload);

  if (!primaryPlan.ok || !primaryPlanId) {
    recordSkip(
      steps,
      'happy-path',
      'RBAP',
      'Dependent plan, goal, and objective checks',
      'POST/GET/PATCH/DELETE',
      '/plans /goals /objectives',
      'The primary plan was not created, so dependent RBAP checks were skipped.',
    );
    return;
  }

  createdRecords.plans.push(primaryPlanId);

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Plans',
    name: 'List visible plans for the office head',
    method: 'GET',
    path: `/plans?planningYear=2030&take=10&skip=0`,
    expectedStatuses: [200],
    headers: authHeaders(officeHead),
  });

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Plans',
    name: 'Get one plan',
    method: 'GET',
    path: `/plans/${primaryPlanId}`,
    expectedStatuses: [200],
    headers: authHeaders(officeHead),
  });

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Plans',
    name: 'Update a draft plan',
    method: 'PATCH',
    path: `/plans/${primaryPlanId}`,
    expectedStatuses: [200],
    headers: authHeaders(officeHead),
    data: {
      monitoringFrequency: 'Monthly',
      reportingOffice: 'RBAP Audit Reporting Office',
    },
  });

  const disposablePlan = await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Plans',
    name: 'Create a second draft plan for delete coverage',
    method: 'POST',
    path: '/plans',
    expectedStatuses: [201],
    headers: authHeaders(officeHead),
    data: buildPlanPayload(fixtures.runTag, 'disposable', 2031),
  });

  const disposablePlanId = extractId(disposablePlan.payload);
  if (disposablePlan.ok && disposablePlanId) {
    createdRecords.plans.push(disposablePlanId);
  }

  const primaryGoal = await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Goals',
    name: 'Create a goal under the primary plan',
    method: 'POST',
    path: `/plans/${primaryPlanId}/goals`,
    expectedStatuses: [201],
    headers: authHeaders(officeHead),
    data: buildGoalPayload(fixtures.runTag, 'primary goal'),
  });

  const primaryGoalId = extractId(primaryGoal.payload);
  if (primaryGoal.ok && primaryGoalId) {
    createdRecords.goals.push(primaryGoalId);
  }

  const disposableGoal = await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Goals',
    name: 'Create a second goal for delete coverage',
    method: 'POST',
    path: `/plans/${primaryPlanId}/goals`,
    expectedStatuses: [201],
    headers: authHeaders(officeHead),
    data: buildGoalPayload(fixtures.runTag, 'disposable goal'),
  });

  const disposableGoalId = extractId(disposableGoal.payload);
  if (disposableGoal.ok && disposableGoalId) {
    createdRecords.goals.push(disposableGoalId);
  }

  if (!primaryGoal.ok || !primaryGoalId) {
    recordSkip(
      steps,
      'happy-path',
      'Objectives',
      'Objective lifecycle coverage',
      'POST/GET/PATCH/DELETE',
      `/plans/${primaryPlanId}/goals/:goalId/objectives`,
      'The primary goal was not created, so objective checks were skipped.',
    );
  } else {
    await callStep<Record<string, unknown>>({
      api,
      steps,
      category: 'happy-path',
      module: 'Goals',
      name: 'List goals under a plan',
      method: 'GET',
      path: `/plans/${primaryPlanId}/goals?take=10&skip=0`,
      expectedStatuses: [200],
      headers: authHeaders(officeHead),
    });

    await callStep<Record<string, unknown>>({
      api,
      steps,
      category: 'happy-path',
      module: 'Goals',
      name: 'Get one goal under a plan',
      method: 'GET',
      path: `/plans/${primaryPlanId}/goals/${primaryGoalId}`,
      expectedStatuses: [200],
      headers: authHeaders(officeHead),
    });

    await callStep<Record<string, unknown>>({
      api,
      steps,
      category: 'happy-path',
      module: 'Goals',
      name: 'Update a goal',
      method: 'PATCH',
      path: `/plans/${primaryPlanId}/goals/${primaryGoalId}`,
      expectedStatuses: [200],
      headers: authHeaders(officeHead),
      data: {
        status: 'IN_PROGRESS',
        timeline: 'Q2-Q4 2030',
      },
    });

    await callStep<Record<string, unknown>>({
      api,
      steps,
      category: 'happy-path',
      module: 'Goals',
      name: 'Browse goals without plan id',
      method: 'GET',
      path: `/goals?planningYear=2030&planId=${primaryPlanId}&take=10&skip=0`,
      expectedStatuses: [200],
      headers: authHeaders(director),
    });

    await callStep<Record<string, unknown>>({
      api,
      steps,
      category: 'happy-path',
      module: 'Goals',
      name: 'Get one goal without plan id',
      method: 'GET',
      path: `/goals/${primaryGoalId}`,
      expectedStatuses: [200],
      headers: authHeaders(director),
    });

    const primaryObjective = await callStep<Record<string, unknown>>({
      api,
      steps,
      category: 'happy-path',
      module: 'Objectives',
      name: 'Create an objective under the primary goal',
      method: 'POST',
      path: `/plans/${primaryPlanId}/goals/${primaryGoalId}/objectives`,
      expectedStatuses: [201],
      headers: authHeaders(officeHead),
      data: buildGoalPayload(fixtures.runTag, 'primary objective'),
    });

    const primaryObjectiveId = extractId(primaryObjective.payload);
    if (primaryObjective.ok && primaryObjectiveId) {
      createdRecords.objectives.push(primaryObjectiveId);
    }

    const disposableObjective = await callStep<Record<string, unknown>>({
      api,
      steps,
      category: 'happy-path',
      module: 'Objectives',
      name: 'Create a second objective for delete coverage',
      method: 'POST',
      path: `/plans/${primaryPlanId}/goals/${primaryGoalId}/objectives`,
      expectedStatuses: [201],
      headers: authHeaders(officeHead),
      data: buildGoalPayload(fixtures.runTag, 'disposable objective'),
    });

    const disposableObjectiveId = extractId(disposableObjective.payload);
    if (disposableObjective.ok && disposableObjectiveId) {
      createdRecords.objectives.push(disposableObjectiveId);
    }

    if (primaryObjective.ok && primaryObjectiveId) {
      await callStep<Record<string, unknown>>({
        api,
        steps,
        category: 'happy-path',
        module: 'Objectives',
        name: 'List objectives under a goal',
        method: 'GET',
        path: `/plans/${primaryPlanId}/goals/${primaryGoalId}/objectives?take=10&skip=0`,
        expectedStatuses: [200],
        headers: authHeaders(officeHead),
      });

      await callStep<Record<string, unknown>>({
        api,
        steps,
        category: 'happy-path',
        module: 'Objectives',
        name: 'Get one objective under a goal',
        method: 'GET',
        path: `/plans/${primaryPlanId}/goals/${primaryGoalId}/objectives/${primaryObjectiveId}`,
        expectedStatuses: [200],
        headers: authHeaders(officeHead),
      });

      await callStep<Record<string, unknown>>({
        api,
        steps,
        category: 'happy-path',
        module: 'Objectives',
        name: 'Update an objective',
        method: 'PATCH',
        path: `/plans/${primaryPlanId}/goals/${primaryGoalId}/objectives/${primaryObjectiveId}`,
        expectedStatuses: [200],
        headers: authHeaders(officeHead),
        data: {
          status: 'COMPLETED',
          timeline: 'Q4 2030',
        },
      });

      await callStep<Record<string, unknown>>({
        api,
        steps,
        category: 'happy-path',
        module: 'Objectives',
        name: 'Browse objectives without goal id',
        method: 'GET',
        path: `/objectives?planningYear=2030&goalId=${primaryGoalId}&take=10&skip=0`,
        expectedStatuses: [200],
        headers: authHeaders(director),
      });

      await callStep<Record<string, unknown>>({
        api,
        steps,
        category: 'happy-path',
        module: 'Objectives',
        name: 'Get one objective without goal id',
        method: 'GET',
        path: `/objectives/${primaryObjectiveId}`,
        expectedStatuses: [200],
        headers: authHeaders(director),
      });
    }

    if (disposableObjectiveId) {
      await callStep<Record<string, unknown>>({
        api,
        steps,
        category: 'happy-path',
        module: 'Objectives',
        name: 'Delete the disposable objective',
        method: 'DELETE',
        path: `/plans/${primaryPlanId}/goals/${primaryGoalId}/objectives/${disposableObjectiveId}`,
        expectedStatuses: [200],
        headers: authHeaders(officeHead),
      });
    }
  }

  if (disposableGoalId) {
    await callStep<Record<string, unknown>>({
      api,
      steps,
      category: 'happy-path',
      module: 'Goals',
      name: 'Delete the disposable goal',
      method: 'DELETE',
      path: `/plans/${primaryPlanId}/goals/${disposableGoalId}`,
      expectedStatuses: [200],
      headers: authHeaders(officeHead),
    });
  }

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Plans',
    name: 'Get plan summary for a director view',
    method: 'GET',
    path: `/plans/summary?officeId=${fixtures.offices.officeHead.id}&planningYear=2030`,
    expectedStatuses: [200],
    headers: authHeaders(director),
  });

  if (disposablePlanId) {
    await callStep<Record<string, unknown>>({
      api,
      steps,
      category: 'happy-path',
      module: 'Plans',
      name: 'Delete the disposable draft plan',
      method: 'DELETE',
      path: `/plans/${disposablePlanId}`,
      expectedStatuses: [200],
      headers: authHeaders(officeHead),
    });
  }

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Plans',
    name: 'Submit the primary plan',
    method: 'PATCH',
    path: `/plans/${primaryPlanId}/submit`,
    expectedStatuses: [200],
    headers: authHeaders(officeHead),
  });

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'policy-check',
    module: 'Plans',
    name: 'Policy check: block updates after submission',
    method: 'PATCH',
    path: `/plans/${primaryPlanId}`,
    expectedStatuses: [403],
    headers: authHeaders(officeHead),
    data: {
      monitoringFrequency: 'Weekly',
    },
  });

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Plans',
    name: 'List pending approvals for the director',
    method: 'GET',
    path: '/plans/pending-approvals?planningYear=2030&take=10&skip=0',
    expectedStatuses: [200],
    headers: authHeaders(director),
  });

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Plans',
    name: 'Approve the submitted plan as director',
    method: 'PATCH',
    path: `/plans/${primaryPlanId}/approve`,
    expectedStatuses: [200],
    headers: authHeaders(director),
  });

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Plans',
    name: 'List visible plans for the director',
    method: 'GET',
    path: `/plans?officeId=${fixtures.offices.officeHead.id}&planningYear=2030&take=10&skip=0`,
    expectedStatuses: [200],
    headers: authHeaders(director),
  });

  await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Plans',
    name: 'Get summary after approval',
    method: 'GET',
    path: `/plans/summary?planningYear=2030`,
    expectedStatuses: [200],
    headers: authHeaders(director),
  });
}

async function loginViaDevEndpoint(
  api: APIRequestContext,
  steps: StepRecord[],
  email: string,
  label: string,
) {
  const result = await callStep<Record<string, unknown>>({
    api,
    steps,
    category: 'happy-path',
    module: 'Auth',
    name: `Dev login for ${label}`,
    method: 'POST',
    path: '/auth/dev-login',
    expectedStatuses: [200],
    data: { email },
  });

  if (!result.ok || !isRecord(result.payload)) {
    return null;
  }

  const accessToken = result.payload.access_token;
  const refreshToken = result.payload.refresh_token;

  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
    return null;
  }

  return {
    email,
    accessToken,
    refreshToken,
  } satisfies AuthSession;
}

function authHeaders(session: AuthSession) {
  return {
    Authorization: `Bearer ${session.accessToken}`,
  };
}

async function callStep<T>({
  api,
  steps,
  category,
  module,
  name,
  method,
  path,
  expectedStatuses,
  headers,
  data,
}: {
  api: APIRequestContext;
  steps: StepRecord[];
  category: StepCategory;
  module: string;
  name: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  expectedStatuses: number[];
  headers?: Record<string, string>;
  data?: Record<string, unknown>;
}): Promise<StepExecutionResult<T>> {
  try {
    const response = await sendRequest(api, method, path, headers, data);
    const payload = (await parseResponse(response)) as T | string | null;
    const actualStatus = response.status();
    const ok = expectedStatuses.includes(actualStatus);

    steps.push({
      category,
      module,
      name,
      method,
      path,
      expectedStatus: expectedStatuses.join(' or '),
      actualStatus,
      outcome: ok ? 'passed' : 'failed',
      responsePreview: truncateForReport(payload),
    });

    return { ok, actualStatus, payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    steps.push({
      category,
      module,
      name,
      method,
      path,
      expectedStatus: expectedStatuses.join(' or '),
      actualStatus: null,
      outcome: 'failed',
      note: message,
    });

    return { ok: false, actualStatus: null, payload: null };
  }
}

function recordSkip(
  steps: StepRecord[],
  category: StepCategory,
  module: string,
  name: string,
  method: string,
  path: string,
  note: string,
) {
  steps.push({
    category,
    module,
    name,
    method,
    path,
    expectedStatus: '-',
    actualStatus: null,
    outcome: 'skipped',
    note,
  });
}

async function sendRequest(
  api: APIRequestContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  headers?: Record<string, string>,
  data?: Record<string, unknown>,
) {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;

  switch (method) {
    case 'GET':
      return api.get(normalizedPath, { headers });
    case 'POST':
      return api.post(normalizedPath, { headers, data });
    case 'PATCH':
      return api.patch(normalizedPath, { headers, data });
    case 'DELETE':
      return api.delete(normalizedPath, { headers, data });
  }
}

async function parseResponse(response: APIResponse) {
  const raw = await response.text();

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return raw;
  }
}

async function seedFixtures(runTag: string): Promise<SeededFixtures> {
  const president = await prisma.user.create({
    data: buildUserSeed(runTag, 'president', 'PRESIDENTS'),
    select: userSeedSelect,
  });
  const vicePresident = await prisma.user.create({
    data: buildUserSeed(runTag, 'vice-president', 'VICE_PRESIDENTS'),
    select: userSeedSelect,
  });
  const director = await prisma.user.create({
    data: buildUserSeed(runTag, 'director', 'DIRECTORS'),
    select: userSeedSelect,
  });
  const officeHead = await prisma.user.create({
    data: buildUserSeed(runTag, 'office-head', 'OFFICE_HEAD'),
    select: userSeedSelect,
  });
  const unassigned = await prisma.user.create({
    data: buildUserSeed(runTag, 'unassigned', 'OFFICE_HEAD'),
    select: userSeedSelect,
  });
  const assignable = await prisma.user.create({
    data: buildUserSeed(runTag, 'assignable', 'OFFICE_HEAD'),
    select: userSeedSelect,
  });
  const newOfficeHead = await prisma.user.create({
    data: buildUserSeed(runTag, 'new-office-head', 'OFFICE_HEAD'),
    select: userSeedSelect,
  });

  const presidentOffice = await prisma.office.create({
    data: { name: `API AUDIT PRESIDENT ${runTag}` },
    select: officeSeedSelect,
  });
  const vicePresidentOffice = await prisma.office.create({
    data: {
      name: `API AUDIT VP ${runTag}`,
      parentId: presidentOffice.id,
    },
    select: officeSeedSelect,
  });
  const directorOffice = await prisma.office.create({
    data: {
      name: `API AUDIT DIRECTOR ${runTag}`,
      parentId: vicePresidentOffice.id,
    },
    select: officeSeedSelect,
  });
  const officeHeadOffice = await prisma.office.create({
    data: {
      name: `API AUDIT OFFICE HEAD ${runTag}`,
      parentId: directorOffice.id,
    },
    select: officeSeedSelect,
  });

  await prisma.$transaction([
    prisma.office.update({
      where: { id: presidentOffice.id },
      data: { headId: president.id },
    }),
    prisma.office.update({
      where: { id: vicePresidentOffice.id },
      data: { headId: vicePresident.id },
    }),
    prisma.office.update({
      where: { id: directorOffice.id },
      data: { headId: director.id },
    }),
    prisma.office.update({
      where: { id: officeHeadOffice.id },
      data: { headId: officeHead.id },
    }),
    prisma.user.update({
      where: { id: president.id },
      data: { officeId: presidentOffice.id },
      select: userSeedSelect,
    }),
    prisma.user.update({
      where: { id: vicePresident.id },
      data: { officeId: vicePresidentOffice.id },
      select: userSeedSelect,
    }),
    prisma.user.update({
      where: { id: director.id },
      data: { officeId: directorOffice.id },
      select: userSeedSelect,
    }),
    prisma.user.update({
      where: { id: officeHead.id },
      data: { officeId: officeHeadOffice.id },
      select: userSeedSelect,
    }),
  ]);

  const [
    updatedPresident,
    updatedVicePresident,
    updatedDirector,
    updatedOfficeHead,
  ] = await prisma.$transaction([
    prisma.user.findUniqueOrThrow({
      where: { id: president.id },
      select: userSeedSelect,
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: vicePresident.id },
      select: userSeedSelect,
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: director.id },
      select: userSeedSelect,
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: officeHead.id },
      select: userSeedSelect,
    }),
  ]);

  const [
    updatedPresidentOffice,
    updatedVicePresidentOffice,
    updatedDirectorOffice,
    updatedOfficeHeadOffice,
  ] = await prisma.$transaction([
    prisma.office.findUniqueOrThrow({
      where: { id: presidentOffice.id },
      select: officeSeedSelect,
    }),
    prisma.office.findUniqueOrThrow({
      where: { id: vicePresidentOffice.id },
      select: officeSeedSelect,
    }),
    prisma.office.findUniqueOrThrow({
      where: { id: directorOffice.id },
      select: officeSeedSelect,
    }),
    prisma.office.findUniqueOrThrow({
      where: { id: officeHeadOffice.id },
      select: officeSeedSelect,
    }),
  ]);

  return {
    runTag,
    users: {
      president: updatedPresident,
      vicePresident: updatedVicePresident,
      director: updatedDirector,
      officeHead: updatedOfficeHead,
      unassigned,
      assignable,
      newOfficeHead,
    },
    offices: {
      president: updatedPresidentOffice,
      vicePresident: updatedVicePresidentOffice,
      director: updatedDirectorOffice,
      officeHead: updatedOfficeHeadOffice,
    },
  };
}

async function buildDatabaseSnapshot(
  fixtures: SeededFixtures | null,
  createdRecords: CreatedRecords,
): Promise<DatabaseSnapshot> {
  if (!fixtures) {
    return {
      users: [],
      offices: [],
      plans: [],
      goals: [],
      objectives: [],
    };
  }

  const userIds = Object.values(fixtures.users).map((user) => user.id);
  const officeIds = [
    ...Object.values(fixtures.offices).map((office) => office.id),
    ...createdRecords.offices,
  ];

  const [users, offices, plans, goals, objectives] = await prisma.$transaction([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      orderBy: { email: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        officeId: true,
      },
    }),
    prisma.office.findMany({
      where: { id: { in: officeIds } },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        parentId: true,
        headId: true,
        status: true,
      },
    }),
    prisma.plan.findMany({
      where: { id: { in: createdRecords.plans } },
      orderBy: { planningYear: 'asc' },
      select: {
        id: true,
        officeId: true,
        createdById: true,
        planningYear: true,
        status: true,
        submittedAt: true,
        approvedAt: true,
      },
    }),
    prisma.goal.findMany({
      where: { id: { in: createdRecords.goals } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        planId: true,
        officeId: true,
        createdById: true,
        resultLevel: true,
        status: true,
      },
    }),
    prisma.objective.findMany({
      where: { id: { in: createdRecords.objectives } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        goalId: true,
        createdById: true,
        resultLevel: true,
        status: true,
      },
    }),
  ]);

  return { users, offices, plans, goals, objectives };
}

function writeAuditFiles({
  runTag,
  steps,
  fixtures,
  createdRecords,
  snapshot,
  baseURL,
}: {
  runTag: string;
  steps: StepRecord[];
  fixtures: SeededFixtures | null;
  createdRecords: CreatedRecords;
  snapshot: DatabaseSnapshot;
  baseURL: string;
}) {
  const docsDir = join(process.cwd(), 'docs');
  mkdirSync(docsDir, { recursive: true });

  const report = {
    generatedAt: new Date().toISOString(),
    runTag,
    baseURL,
    summary: {
      total: steps.length,
      passed: steps.filter((step) => step.outcome === 'passed').length,
      failed: steps.filter((step) => step.outcome === 'failed').length,
      skipped: steps.filter((step) => step.outcome === 'skipped').length,
    },
    fixtures,
    createdRecords,
    snapshot,
    steps,
  };

  writeFileSync(
    join(docsDir, 'playwright-api-audit.latest.json'),
    `${JSON.stringify(sanitizeValue(report), null, 2)}\n`,
    'utf8',
  );

  const markdown = [
    '# Playwright API Audit Report',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Run tag: ${runTag}`,
    `- Base URL: ${baseURL}`,
    '',
    '## Summary',
    '',
    `- Total steps: ${report.summary.total}`,
    `- Passed: ${report.summary.passed}`,
    `- Failed: ${report.summary.failed}`,
    `- Skipped: ${report.summary.skipped}`,
    '',
    '## Why The Audit Seeds Some Data Directly',
    '',
    '- The API has dev-login, but it does not have a public create-user endpoint.',
    '- Because of that, the audit inserts traceable users and offices with Prisma first, then authenticates those same users through POST /auth/dev-login.',
    '- This keeps auth, guards, and endpoint behavior under test while still making the run repeatable.',
    '',
    '## Happy-Path And Policy Checks',
    '',
    renderTable(
      [
        'Category',
        'Module',
        'Step',
        'Method',
        'Path',
        'Expected',
        'Actual',
        'Outcome',
      ],
      steps
        .filter((step) => step.category !== 'known-issue')
        .map((step) => [
          step.category,
          step.module,
          step.name,
          step.method,
          step.path,
          step.expectedStatus,
          step.actualStatus ?? '-',
          step.outcome,
        ]),
    ),
    '',
    '## Known Issue Checks',
    '',
    renderTable(
      [
        'Module',
        'Step',
        'Method',
        'Path',
        'Expected',
        'Actual',
        'Outcome',
        'Note',
      ],
      steps
        .filter((step) => step.category === 'known-issue')
        .map((step) => [
          step.module,
          step.name,
          step.method,
          step.path,
          step.expectedStatus,
          step.actualStatus ?? '-',
          step.outcome,
          step.note ?? '',
        ]),
    ),
    '',
    '## Inserted Fixture Users',
    '',
    renderTable(
      ['Role', 'Id', 'Email', 'OfficeId', 'Status'],
      fixtures
        ? Object.entries(fixtures.users).map(([role, user]) => [
            role,
            user.id,
            user.email,
            user.officeId ?? 'null',
            user.status,
          ])
        : [],
    ),
    '',
    '## Inserted Fixture Offices',
    '',
    renderTable(
      ['Office', 'Id', 'ParentId', 'HeadId', 'Status'],
      fixtures
        ? Object.entries(fixtures.offices).map(([name, office]) => [
            name,
            office.id,
            office.parentId ?? 'null',
            office.headId ?? 'null',
            office.status,
          ])
        : [],
    ),
    '',
    '## API-Created Record Ids',
    '',
    renderTable(
      ['Table', 'Ids'],
      [
        ['Office', createdRecords.offices.join(', ') || '(none)'],
        ['Plan', createdRecords.plans.join(', ') || '(none)'],
        ['Goal', createdRecords.goals.join(', ') || '(none)'],
        ['Objective', createdRecords.objectives.join(', ') || '(none)'],
      ],
    ),
    '',
    '## Final Database Snapshot',
    '',
    '### Users',
    '',
    renderTable(
      ['Id', 'Email', 'Role', 'Status', 'OfficeId'],
      snapshot.users.map((user) => [
        user.id,
        user.email,
        user.role,
        user.status,
        user.officeId ?? 'null',
      ]),
    ),
    '',
    '### Offices',
    '',
    renderTable(
      ['Id', 'Name', 'ParentId', 'HeadId', 'Status'],
      snapshot.offices.map((office) => [
        office.id,
        office.name,
        office.parentId ?? 'null',
        office.headId ?? 'null',
        office.status,
      ]),
    ),
    '',
    '### Plans',
    '',
    renderTable(
      [
        'Id',
        'OfficeId',
        'CreatedById',
        'PlanningYear',
        'Status',
        'SubmittedAt',
        'ApprovedAt',
      ],
      snapshot.plans.map((plan) => [
        plan.id,
        plan.officeId,
        plan.createdById,
        plan.planningYear,
        plan.status,
        plan.submittedAt ?? 'null',
        plan.approvedAt ?? 'null',
      ]),
    ),
    '',
    '### Goals',
    '',
    renderTable(
      ['Id', 'PlanId', 'OfficeId', 'CreatedById', 'ResultLevel', 'Status'],
      snapshot.goals.map((goal) => [
        goal.id,
        goal.planId,
        goal.officeId,
        goal.createdById,
        goal.resultLevel,
        goal.status,
      ]),
    ),
    '',
    '### Objectives',
    '',
    renderTable(
      ['Id', 'GoalId', 'CreatedById', 'ResultLevel', 'Status'],
      snapshot.objectives.map((objective) => [
        objective.id,
        objective.goalId,
        objective.createdById,
        objective.resultLevel,
        objective.status,
      ]),
    ),
    '',
    '## How To Inspect The Rows In PostgreSQL',
    '',
    '- Filter users by email prefix like `api.audit.` and the run tag shown above.',
    '- Filter offices by names that start with `API AUDIT`.',
    '- Match plans, goals, and objectives with the ids listed in the API-created records table.',
    '',
    '## Flow Map',
    '',
    '- See docs/rbap-api-flow-map.md for the table relationship map and the request lifecycle.',
    '',
    '## Raw Response Notes',
    '',
    ...steps
      .map((step) => [
        `### ${step.module} - ${step.name}`,
        '',
        `- Endpoint: ${step.method} ${step.path}`,
        `- Expected: ${step.expectedStatus}`,
        `- Actual: ${step.actualStatus ?? 'no response'}`,
        `- Outcome: ${step.outcome}`,
        ...(step.note ? [`- Note: ${step.note}`] : []),
        ...(step.responsePreview
          ? ['```json', step.responsePreview, '```']
          : []),
        '',
      ])
      .flat(),
  ].join('\n');

  writeFileSync(
    join(docsDir, 'playwright-api-audit.latest.md'),
    markdown,
    'utf8',
  );
}

function renderTable(headers: string[], rows: Array<Array<unknown>>) {
  if (rows.length === 0) {
    return '_No rows recorded._';
  }

  const headerRow = `| ${headers.join(' | ')} |`;
  const dividerRow = `| ${headers.map(() => '---').join(' | ')} |`;
  const bodyRows = rows.map(
    (row) => `| ${row.map((value) => escapeCell(value)).join(' | ')} |`,
  );

  return [headerRow, dividerRow, ...bodyRows].join('\n');
}

function escapeCell(value: unknown) {
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }

  if (!isRecord(value)) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (key === 'access_token' || key === 'refresh_token') {
      sanitized[key] = '<redacted>';
      continue;
    }

    if (key === 'passwordHash' || key === 'googleId' || key === 'email') {
      sanitized[key] = '<redacted>';
      continue;
    }

    sanitized[key] = sanitizeValue(entry);
  }

  return sanitized;
}

function truncateForReport(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const rendered =
    typeof value === 'string'
      ? value
      : JSON.stringify(sanitizeValue(value), null, 2);

  return rendered.length > 1200 ? `${rendered.slice(0, 1200)}...` : rendered;
}

function formatUnexpectedFailures(steps: StepRecord[]) {
  if (steps.length === 0) {
    return 'No unexpected endpoint failures were recorded.';
  }

  return steps
    .map(
      (step) =>
        `${step.module} :: ${step.name} (${step.method} ${step.path}) expected ${step.expectedStatus} but got ${step.actualStatus ?? 'no response'}`,
    )
    .join('\n');
}

function buildRunTag() {
  const isoStamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const randomSuffix = Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, '0');
  return `${isoStamp}${randomSuffix}`;
}

function buildUserSeed(runTag: string, label: string, role: string) {
  return {
    email: `api.audit.${runTag}.${label}@chmsu.edu.ph`,
    name: `API Audit ${label} ${runTag}`,
    googleId: `api-audit-${runTag}-${label}`,
    role,
  };
}

function buildPlanPayload(
  runTag: string,
  variant: string,
  planningYear: number,
) {
  return {
    planningYear,
    campus: `Main Campus ${variant}`,
    programProjectActivityKRA: `KRA ${variant} ${runTag}`,
    strategicAlignment: `Strategic Alignment ${variant} ${runTag}`,
    breakthroughGoals: `Breakthrough Goal ${variant} ${runTag}`,
    strategicObjectives: `Strategic Objective ${variant} ${runTag}`,
    datePrepared: `${planningYear}-01-15`,
    monitoringFrequency: 'Quarterly',
    reportingOffice: `Reporting Office ${variant} ${runTag}`,
  };
}

function buildGoalPayload(runTag: string, label: string) {
  return {
    resultLevel: `Result Level ${label} ${runTag}`,
    targetResult: `Target Result ${label} ${runTag}`,
    keyActions: `Key Actions ${label} ${runTag}`,
    keyRisk: `Key Risk ${label} ${runTag}`,
    mitigationMeasures: `Mitigation ${label} ${runTag}`,
    keyPerformanceIndicator: `KPI ${label} ${runTag}`,
    target: `Target ${label} ${runTag}`,
    responsibleOfficePerson: `Responsible Person ${label} ${runTag}`,
    timeline: `Timeline ${label} ${runTag}`,
    fundSource: `Fund Source ${label} ${runTag}`,
    budgetRequirements: 1000,
    budgetAllocation: 750,
    meansOfVerification: `MOV ${label} ${runTag}`,
  };
}

function extractId(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }

  return typeof payload.id === 'string' ? payload.id : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const userSeedSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  officeId: true,
  status: true,
} as const;

const officeSeedSelect = {
  id: true,
  name: true,
  parentId: true,
  headId: true,
  status: true,
} as const;
