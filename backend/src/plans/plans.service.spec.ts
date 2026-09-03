import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  calculateNeedsAttention,
  calculateObjectiveMetrics,
  PlansService,
} from './plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { OfficesService } from '../offices/offices.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const officeHead: AuthenticatedUser = {
  id: 'office-head',
  email: 'head@chmsu.edu.ph',
  name: 'Office Head',
  role: 'OFFICE_HEAD',
  status: 'ACTIVE',
  hasPassword: true,
  office: { id: 'office-head-office', name: 'Office Head Office' },
};

const director: AuthenticatedUser = {
  id: 'director',
  email: 'director@chmsu.edu.ph',
  name: 'Director',
  role: 'DIRECTORS',
  status: 'ACTIVE',
  hasPassword: true,
  office: { id: 'director-office', name: 'Director Office' },
};

const admin: AuthenticatedUser = {
  id: 'admin',
  email: 'admin@chmsu.edu.ph',
  name: 'Admin',
  role: 'ADMIN',
  status: 'ACTIVE',
  hasPassword: true,
  office: { id: 'admin-office', name: 'Admin Office' },
};

const qmAdmin: AuthenticatedUser = {
  ...admin,
  accountId: 'qm-admin-account',
  workspace: 'QM',
  account: {
    id: 'qm-admin-account',
    workspace: 'QM',
    role: 'ADMIN',
    status: 'ACTIVE',
    office: { id: 'qm-office', name: 'Quality Management' },
  },
};

const submittedPlan = {
  id: 'plan-1',
  officeId: 'office-head-office',
  status: 'SUBMITTED',
  planningYear: 2026,
  createdBy: {
    id: officeHead.id,
    role: 'OFFICE_HEAD',
    supervisorId: director.id,
  },
  office: { name: 'Office Head Office' },
};

const draftPlan = { ...submittedPlan, status: 'DRAFT' };

describe('PlansService approval hierarchy', () => {
  let service: PlansService;

  const txMock = {
    plan: { update: jest.fn() },
    planRemark: { create: jest.fn() },
    user: { findUnique: jest.fn() },
    notification: { create: jest.fn() },
    activityLog: { create: jest.fn() },
  };

  const prismaMock = {
    plan: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    planRemark: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    notification: { create: jest.fn() },
    goal: { groupBy: jest.fn() },
    $transaction: jest.fn(),
  };

  const officesServiceMock = {
    getAccessibleOfficeIds: jest.fn(),
  };

  const activityLogServiceMock = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: OfficesService, useValue: officesServiceMock },
        { provide: NotificationsService, useValue: {} },
        { provide: ActivityLogService, useValue: activityLogServiceMock },
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
    prismaMock.$transaction.mockImplementation(
      async (callback: (tx: typeof txMock) => Promise<unknown>) =>
        callback(txMock),
    );
  });

  describe('Plans dashboard calculations', () => {
    it('calculates achievement as completed objectives over total objectives', () => {
      expect(
        calculateObjectiveMetrics([
          { status: 'COMPLETED' },
          { status: 'IN_PROGRESS' },
          { status: 'COMPLETED' },
        ]),
      ).toEqual({
        totalObjectives: 3,
        completedObjectives: 2,
        achievementRate: 66.67,
      });
    });

    it('treats a plan with no objectives as 0% and needing attention', () => {
      const metrics = calculateObjectiveMetrics([]);

      expect(metrics.achievementRate).toBe(0);
      expect(calculateNeedsAttention(true, 0, metrics.achievementRate)).toBe(
        true,
      );
    });

    it('marks missing plans and drafts as needing attention', () => {
      expect(calculateNeedsAttention(false, 0, 100)).toBe(true);
      expect(calculateNeedsAttention(true, 1, 100)).toBe(true);
      expect(calculateNeedsAttention(true, 0, 100)).toBe(false);
    });

    it('rejects report filters outside the signed-in user office scope', async () => {
      const service = new PlansService(
        { $transaction: jest.fn() } as never,
        {
          getAccessibleOfficeIds: jest.fn().mockResolvedValue(['office-a']),
        } as never,
        {} as never,
        {} as never,
      );

      await expect(
        service.getReports(admin, { officeId: 'office-outside' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects RBAP dashboard and report queries from a QM workspace account', async () => {
      const service = new PlansService(
        { $transaction: jest.fn() } as never,
        { getAccessibleOfficeIds: jest.fn() } as never,
        {} as never,
        {} as never,
      );

      await expect(service.getSummary(qmAdmin, {})).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.getReports(qmAdmin, {})).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  it('rejects approval from a reviewer who is not assigned to the submitter', async () => {
    prismaMock.plan.findUnique.mockResolvedValue(submittedPlan);

    await expect(service.approve('plan-1', { ...director, id: 'other-user' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('allows an admin with an assigned office to create a plan', async () => {
    prismaMock.plan.findUnique.mockResolvedValue(null);
    prismaMock.plan.create.mockResolvedValue({
      id: 'admin-plan',
      office: { id: admin.office?.id, name: admin.office?.name },
      planningYear: 2026,
    });
    prismaMock.user.findMany.mockResolvedValue([]);

    await expect(
      service.create(
        {
          planningYear: 2026,
          campus: 'Main Campus',
          programProjectActivityKRA: 'KRA',
          strategicAlignment: 'Alignment',
          breakthroughGoals: 'Goals',
          strategicObjectives: 'Objectives',
        },
        admin,
      ),
    ).resolves.toEqual(expect.objectContaining({ id: 'admin-plan' }));
  });

  it('allows the assigned supervisor to approve the submitted plan', async () => {
    prismaMock.plan.findUnique.mockResolvedValue(submittedPlan);
    officesServiceMock.getAccessibleOfficeIds.mockResolvedValue([
      submittedPlan.officeId,
    ]);
    txMock.plan.update.mockResolvedValue({
      id: submittedPlan.id,
      officeId: submittedPlan.officeId,
      createdById: officeHead.id,
      office: submittedPlan.office,
    });

    txMock.notification.create.mockResolvedValue(undefined);
    prismaMock.plan.findFirst.mockResolvedValue({ id: submittedPlan.id });

    const result = await service.approve('plan-1', director);

    expect(result).toEqual({ id: submittedPlan.id });
    expect(txMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: officeHead.id,
          link: '/plans/plan-1/view',
        }),
      }),
    );
  });

  it('returns a submitted plan, persists feedback, and notifies its owner', async () => {
    prismaMock.plan.findUnique.mockResolvedValue(submittedPlan);
    officesServiceMock.getAccessibleOfficeIds.mockResolvedValue([
      submittedPlan.officeId,
    ]);
    txMock.planRemark.create.mockResolvedValue({
      id: 'plan-remark-1',
    });
    txMock.plan.update.mockResolvedValue({
      id: submittedPlan.id,
      officeId: submittedPlan.officeId,
      createdById: officeHead.id,
      office: submittedPlan.office,
    });
    txMock.notification.create.mockResolvedValue(undefined);
    txMock.activityLog.create.mockResolvedValue(undefined);
    prismaMock.plan.findFirst.mockResolvedValue({ id: submittedPlan.id });

    const result = await service.returnPlan(
      'plan-1',
      { content: 'Please revise the targets.' },
      director,
    );

    expect(result).toEqual({ id: submittedPlan.id });
    expect(txMock.planRemark.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          planId: submittedPlan.id,
          authorId: director.id,
          content: 'Please revise the targets.',
        }),
      }),
    );
    expect(txMock.plan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: 'DRAFT',
          submittedAt: null,
          approvedAt: null,
        },
      }),
    );
    expect(txMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: officeHead.id,
          link: '/plans/plan-1/view',
        }),
      }),
    );
    expect(txMock.activityLog.create).toHaveBeenCalled();
  });

  it('rejects returning a submitted plan by an unassigned reviewer', async () => {
    prismaMock.plan.findUnique.mockResolvedValue(submittedPlan);

    await expect(
      service.returnPlan(
        'plan-1',
        { content: 'Please revise the targets.' },
        { ...director, id: 'other-user' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('notifies only the assigned supervisor when a plan is submitted', async () => {
    prismaMock.plan.findUnique.mockResolvedValue(draftPlan);
    officesServiceMock.getAccessibleOfficeIds.mockResolvedValue([
      draftPlan.officeId,
    ]);
    txMock.plan.update.mockResolvedValue({
      id: draftPlan.id,
      officeId: draftPlan.officeId,
      office: draftPlan.office,
    });
    txMock.user.findUnique.mockResolvedValue({
      id: director.id,
      role: 'DIRECTORS',
      status: 'ACTIVE',
    });
    txMock.notification.create.mockResolvedValue(undefined);
    prismaMock.plan.findFirst.mockResolvedValue({ id: draftPlan.id });

    await service.submit('plan-1', officeHead);

    expect(txMock.notification.create).toHaveBeenCalledTimes(1);
    expect(txMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: director.id }),
      }),
    );
  });

  it('requires a valid assigned supervisor before submission', async () => {
    prismaMock.plan.findUnique.mockResolvedValue({
      ...draftPlan,
      createdBy: { ...draftPlan.createdBy, supervisorId: null },
    });

    await expect(service.submit('plan-1', officeHead)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(txMock.notification.create).not.toHaveBeenCalled();
  });
});
