import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { GoalsService } from './goals.service';
import { PrismaService } from '../prisma/prisma.service';
import { OfficesService } from '../offices/offices.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'test@chmsu.edu.ph',
  name: 'Test User',
  role: 'OFFICE_HEAD',
  status: 'ACTIVE',
  hasPassword: true,
  office: { id: 'off-1', name: 'Test Office' },
};

const mockGoal = {
  id: 'goal-1',
  planId: 'plan-1',
  officeId: 'off-1',
  resultLevel: 'Level 1',
  targetResult: 'Target',
  keyActions: 'Actions',
  keyRisk: 'Risk',
  mitigationMeasures: 'Mitigation',
  keyPerformanceIndicator: 'KPI',
  target: 'Target value',
  responsibleOfficePerson: 'Person',
  timeline: 'Q1 2026',
  fundSource: null,
  budgetRequirements: 1000,
  budgetAllocation: 500,
  meansOfVerification: 'Verification',
  status: 'NOT_STARTED',
  createdAt: new Date(),
  updatedAt: new Date(),
  office: { id: 'off-1', name: 'Test Office' },
  plan: { id: 'plan-1', planningYear: 2026, status: 'DRAFT' },
  createdBy: { id: 'user-1', email: 'test@chmsu.edu.ph', name: 'Test User', role: 'OFFICE_HEAD' },
  _count: { objectives: 0 },
};

const mockPlan = {
  id: 'plan-1',
  officeId: 'off-1',
  status: 'DRAFT',
};

const officesServiceMock = {
  getAccessibleOfficeIds: jest.fn<(args: any) => Promise<any>>(),
};

const activityLogServiceMock = {
  log: jest.fn<(args: any) => Promise<any>>(),
};

const prismaMock = {
  goal: {
    create: jest.fn<(args: any) => Promise<any>>(),
    findMany: jest.fn<(args: any) => Promise<any>>(),
    findFirst: jest.fn<(args: any) => Promise<any>>(),
    update: jest.fn<(args: any) => Promise<any>>(),
    delete: jest.fn<(args: any) => Promise<any>>(),
    count: jest.fn<(args: any) => Promise<any>>(),
  },
  plan: {
    findUnique: jest.fn<(args: any) => Promise<any>>(),
    findFirst: jest.fn<(args: any) => Promise<any>>(),
  },
  user: {
    findMany: jest.fn<(args: any) => Promise<any>>(),
  },
  notification: {
    createMany: jest.fn<(args: any) => Promise<any>>(),
  },
  $transaction: jest.fn<(args: any) => Promise<any>>(),
};

describe('GoalsService', () => {
  let service: GoalsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: OfficesService, useValue: officesServiceMock },
        { provide: ActivityLogService, useValue: activityLogServiceMock },
      ],
    }).compile();

    service = module.get<GoalsService>(GoalsService);
  });

  describe('create', () => {
    it('creates a goal under a plan', async () => {
      (prismaMock.plan.findUnique as any).mockResolvedValueOnce(mockPlan);
      (prismaMock.goal.create as any).mockResolvedValue(mockGoal);
      (prismaMock.plan.findUnique as any).mockResolvedValueOnce({ office: { name: 'Test Office' } });
      (prismaMock.user.findMany as any).mockResolvedValue([]);
      (activityLogServiceMock.log as any).mockResolvedValue(undefined);

      const dto = {
        resultLevel: 'Level 1',
        targetResult: 'Target',
        keyActions: 'Actions',
        keyRisk: 'Risk',
        mitigationMeasures: 'Mitigation',
        keyPerformanceIndicator: 'KPI',
        target: 'Target value',
        responsibleOfficePerson: 'Person',
        timeline: 'Q1 2026',
        meansOfVerification: 'Verification',
      };

      const result = await service.create('plan-1', dto, mockUser);

      expect(result.id).toBe('goal-1');
      expect(prismaMock.goal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ planId: 'plan-1' }),
        }),
      );
    });

    it('throws NotFoundException when plan does not exist', async () => {
      (prismaMock.plan.findUnique as any).mockResolvedValue(null);

      await expect(service.create('plan-999', {} as any, mockUser)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns paginated goals for a plan', async () => {
      (officesServiceMock.getAccessibleOfficeIds as any).mockResolvedValue(['off-1']);
      (prismaMock.plan.findFirst as any).mockResolvedValue(mockPlan);
      (prismaMock.$transaction as any).mockResolvedValue([[mockGoal], 1]);

      const result = await service.findAll('plan-1', mockUser, 20, 0);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('throws NotFoundException when plan is inaccessible', async () => {
      (officesServiceMock.getAccessibleOfficeIds as any).mockResolvedValue(['off-2']);
      (prismaMock.plan.findFirst as any).mockResolvedValue(null);

      await expect(service.findAll('plan-1', mockUser)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAllVisible', () => {
    it('returns goals accessible to user', async () => {
      (officesServiceMock.getAccessibleOfficeIds as any).mockResolvedValue(['off-1']);
      (prismaMock.$transaction as any).mockResolvedValue([[mockGoal], 1]);

      const result = await service.findAllVisible(mockUser, {});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('returns empty array when user has no accessible offices', async () => {
      (officesServiceMock.getAccessibleOfficeIds as any).mockResolvedValue([]);

      const result = await service.findAllVisible(mockUser, {});

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('returns a goal by planId and goalId', async () => {
      (officesServiceMock.getAccessibleOfficeIds as any).mockResolvedValue(['off-1']);
      (prismaMock.plan.findFirst as any).mockResolvedValue(mockPlan);
      (prismaMock.goal.findFirst as any).mockResolvedValue(mockGoal);

      const result = await service.findOne('plan-1', 'goal-1', mockUser);

      expect(result.id).toBe('goal-1');
    });

    it('throws NotFoundException when goal is not found', async () => {
      (officesServiceMock.getAccessibleOfficeIds as any).mockResolvedValue(['off-1']);
      (prismaMock.plan.findFirst as any).mockResolvedValue(mockPlan);
      (prismaMock.goal.findFirst as any).mockResolvedValue(null);

      await expect(service.findOne('plan-1', 'goal-999', mockUser)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findOneVisible', () => {
    it('returns a goal by id with office access check', async () => {
      (officesServiceMock.getAccessibleOfficeIds as any).mockResolvedValue(['off-1']);
      (prismaMock.goal.findFirst as any).mockResolvedValue(mockGoal);

      const result = await service.findOneVisible('goal-1', mockUser);

      expect(result.id).toBe('goal-1');
    });

    it('throws NotFoundException when goal is not in accessible offices', async () => {
      (officesServiceMock.getAccessibleOfficeIds as any).mockResolvedValue(['off-2']);
      (prismaMock.goal.findFirst as any).mockResolvedValue(null);

      await expect(service.findOneVisible('goal-999', mockUser)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates a goal', async () => {
      (prismaMock.goal.findFirst as any).mockResolvedValue(mockGoal);
      (prismaMock.goal.update as any).mockResolvedValue(mockGoal);
      (activityLogServiceMock.log as any).mockResolvedValue(undefined);

      const result = await service.update('plan-1', 'goal-1', { resultLevel: 'Updated' }, mockUser);

      expect(result.id).toBe('goal-1');
    });

    it('rejects updates when the parent plan is submitted', async () => {
      const submittedGoal = {
        ...mockGoal,
        plan: { ...mockGoal.plan, status: 'SUBMITTED' },
      };
      (prismaMock.goal.findFirst as any).mockResolvedValue(submittedGoal);

      await expect(
        service.update(
          'plan-1',
          'goal-1',
          { resultLevel: 'Updated after submission' },
          mockUser,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prismaMock.goal.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when user is not admin and not in same office', async () => {
      const otherUser = { ...mockUser, office: { id: 'off-2', name: 'Other Office' } };
      (prismaMock.goal.findFirst as any).mockResolvedValue(mockGoal);

      await expect(service.update('plan-1', 'goal-1', {} as any, otherUser)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException on P2025 error', async () => {
      const { PrismaClientKnownRequestError } = jest.requireActual('@prisma/client/runtime/client');
      const p2025Error = new PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.6.0' });

      (prismaMock.goal.findFirst as any).mockResolvedValue(mockGoal);
      (prismaMock.goal.update as any).mockRejectedValue(p2025Error);

      await expect(service.update('plan-1', 'goal-1', {} as any, mockUser)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it('deletes a goal', async () => {
      (prismaMock.goal.findFirst as any).mockResolvedValue(mockGoal);
      (prismaMock.goal.delete as any).mockResolvedValue(mockGoal);
      (activityLogServiceMock.log as any).mockResolvedValue(undefined);

      const result = await service.delete('plan-1', 'goal-1', mockUser);

      expect(result.id).toBe('goal-1');
    });

    it('throws NotFoundException on P2025 error', async () => {
      const { PrismaClientKnownRequestError } = jest.requireActual('@prisma/client/runtime/client');
      const p2025Error = new PrismaClientKnownRequestError('Record not found', { code: 'P2025', clientVersion: '7.6.0' });

      (prismaMock.goal.findFirst as any).mockResolvedValue(mockGoal);
      (prismaMock.goal.delete as any).mockRejectedValue(p2025Error);

      await expect(service.delete('plan-1', 'goal-1', mockUser)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
