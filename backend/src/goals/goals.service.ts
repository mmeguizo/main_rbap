import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OfficesService } from '../offices/offices.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateGoalDto } from './dto/create-goal.dto';
import { QueryGoalsDto } from './dto/query-goals.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

const goalSelect = {
  id: true,
  planId: true,
  officeId: true,
  resultLevel: true,
  targetResult: true,
  keyActions: true,
  keyRisk: true,
  mitigationMeasures: true,
  keyPerformanceIndicator: true,
  target: true,
  responsibleOfficePerson: true,
  timeline: true,
  fundSource: true,
  budgetRequirements: true,
  budgetAllocation: true,
  budgetDeficit: true,
  meansOfVerification: true,
  code: true,
  displayOrder: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  office: {
    select: {
      id: true,
      name: true,
    },
  },
  plan: {
    select: {
      id: true,
      planningYear: true,
      status: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  },
  _count: {
    select: {
      objectives: true,
    },
  },
} as const;

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly officesService: OfficesService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async create(planId: string, dto: CreateGoalDto, user: AuthenticatedUser) {
    const plan = await this.getPlanScope(planId);
    this.ensureCanManagePlan(user, plan.officeId, plan.status);

    const goal = await this.prisma.goal.create({
      data: {
        planId,
        officeId: plan.officeId,
        createdById: user.id,
        resultLevel: dto.resultLevel,
        targetResult: dto.targetResult,
        keyActions: dto.keyActions,
        keyRisk: dto.keyRisk,
        mitigationMeasures: dto.mitigationMeasures,
        keyPerformanceIndicator: dto.keyPerformanceIndicator,
        target: dto.target,
        responsibleOfficePerson: dto.responsibleOfficePerson,
        timeline: dto.timeline,
        fundSource: dto.fundSource,
        budgetRequirements: dto.budgetRequirements ?? 0,
        budgetAllocation: dto.budgetAllocation ?? 0,
        budgetDeficit: dto.budgetDeficit ?? 0,
        meansOfVerification: dto.meansOfVerification,
        code: dto.code ?? dto.resultLevel,
        displayOrder: dto.displayOrder ?? 0,
      },
      select: goalSelect,
    });

    const planWithOffice = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: { office: { select: { name: true } } },
    });

    const adminUsers = await this.prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
    });

    const recipientUsers = adminUsers.filter((u) => u.id !== user.id);

    if (recipientUsers.length > 0 && planWithOffice) {
      await this.prisma.notification.createMany({
        data: recipientUsers.map((u) => ({
          userId: u.id,
          title: 'New Goal Added',
          message: `${planWithOffice.office.name} has added a new goal to their plan.`,
          type: 'INFO' as const,
          link: `/goals?goal=${goal.id}`,
        })),
      });
    }

    await this.activityLogService.log(
      user.id,
      'GOAL_CREATED',
      'Goal',
      goal.id,
      { planId, resultLevel: dto.resultLevel },
    );

    return goal;
  }

  async findAll(planId: string, user: AuthenticatedUser, take = 20, skip = 0) {
    await this.findAccessiblePlan(planId, user);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.goal.findMany({
        where: { planId },
        take,
        skip,
        orderBy: [{ createdAt: 'asc' }, { resultLevel: 'asc' }],
        select: goalSelect,
      }),
      this.prisma.goal.count({ where: { planId } }),
    ]);

    return { data, meta: { total, take, skip, returned: data.length } };
  }

  async findAllVisible(user: AuthenticatedUser, query: QueryGoalsDto) {
    const {
      take = 20,
      skip = 0,
      officeId,
      planId,
      planningYear,
      status,
      search,
    } = query;
    const officeIds = await this.officesService.getAccessibleOfficeIds(user);

    if (officeIds.length === 0) {
      return { data: [], meta: { total: 0, take, skip, returned: 0 } };
    }

    if (officeId && !officeIds.includes(officeId)) {
      throw new ForbiddenException('You cannot filter goals for that office.');
    }

    const where = {
      officeId: { in: officeId ? [officeId] : officeIds },
      ...(planId !== undefined && { planId }),
      ...(planningYear !== undefined && { plan: { planningYear } }),
      ...(status !== undefined && { status }),
      ...(search && {
        OR: [
          { resultLevel: { contains: search, mode: 'insensitive' as const } },
          { targetResult: { contains: search, mode: 'insensitive' as const } },
          { keyPerformanceIndicator: { contains: search, mode: 'insensitive' as const } },
          { responsibleOfficePerson: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.goal.findMany({
        where,
        take,
        skip,
        orderBy: [
          { plan: { planningYear: 'desc' } },
          { createdAt: 'asc' },
          { resultLevel: 'asc' },
        ],
        select: goalSelect,
      }),
      this.prisma.goal.count({ where }),
    ]);

    return { data, meta: { total, take, skip, returned: data.length } };
  }

  async findOneVisible(goalId: string, user: AuthenticatedUser) {
    const officeIds = await this.officesService.getAccessibleOfficeIds(user);

    if (officeIds.length === 0) {
      throw new NotFoundException('Goal not found.');
    }

    const goal = await this.prisma.goal.findFirst({
      where: {
        id: goalId,
        officeId: { in: officeIds },
      },
      select: goalSelect,
    });

    if (!goal) {
      throw new NotFoundException('Goal not found.');
    }

    return goal;
  }

  async findOne(planId: string, goalId: string, user: AuthenticatedUser) {
    await this.findAccessiblePlan(planId, user);

    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, planId },
      select: goalSelect,
    });

    if (!goal) {
      throw new NotFoundException('Goal not found.');
    }

    return goal;
  }

  async update(
    planId: string,
    goalId: string,
    dto: UpdateGoalDto,
    user: AuthenticatedUser,
  ) {
    const goal = await this.getGoalScope(planId, goalId);
    this.ensureCanManagePlan(user, goal.officeId, goal.plan.status);

    try {
      const updated = await this.prisma.goal.update({
        where: { id: goalId },
        data: {
          ...(dto.resultLevel !== undefined && { resultLevel: dto.resultLevel }),
          ...(dto.targetResult !== undefined && {
            targetResult: dto.targetResult,
          }),
          ...(dto.keyActions !== undefined && { keyActions: dto.keyActions }),
          ...(dto.keyRisk !== undefined && { keyRisk: dto.keyRisk }),
          ...(dto.mitigationMeasures !== undefined && {
            mitigationMeasures: dto.mitigationMeasures,
          }),
          ...(dto.keyPerformanceIndicator !== undefined && {
            keyPerformanceIndicator: dto.keyPerformanceIndicator,
          }),
          ...(dto.target !== undefined && { target: dto.target }),
          ...(dto.responsibleOfficePerson !== undefined && {
            responsibleOfficePerson: dto.responsibleOfficePerson,
          }),
          ...(dto.timeline !== undefined && { timeline: dto.timeline }),
          ...(dto.fundSource !== undefined && { fundSource: dto.fundSource }),
          ...(dto.budgetRequirements !== undefined && {
            budgetRequirements: dto.budgetRequirements,
          }),
          ...(dto.budgetAllocation !== undefined && {
            budgetAllocation: dto.budgetAllocation,
          }),
          ...(dto.budgetDeficit !== undefined && {
            budgetDeficit: dto.budgetDeficit,
          }),
          ...(dto.meansOfVerification !== undefined && {
            meansOfVerification: dto.meansOfVerification,
          }),
          ...(dto.code !== undefined && { code: dto.code }),
          ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
        select: goalSelect,
      });

      await this.activityLogService.log(
        user.id,
        'GOAL_UPDATED',
        'Goal',
        goalId,
        { planId },
      );

      return updated;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Goal not found');
      }
      throw e;
    }
  }

  async delete(planId: string, goalId: string, user: AuthenticatedUser) {
    const goal = await this.getGoalScope(planId, goalId);
    this.ensureCanManagePlan(user, goal.officeId, goal.plan.status);

    try {
      const deleted = await this.prisma.goal.delete({
        where: { id: goalId },
        select: goalSelect,
      });

      await this.activityLogService.log(
        user.id,
        'GOAL_DELETED',
        'Goal',
        goalId,
        { planId },
      );

      return deleted;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Goal not found');
      }
      throw e;
    }
  }

  private async findAccessiblePlan(planId: string, user: AuthenticatedUser) {
    const officeIds = await this.officesService.getAccessibleOfficeIds(user);

    if (officeIds.length === 0) {
      throw new NotFoundException('Plan not found.');
    }

    const plan = await this.prisma.plan.findFirst({
      where: {
        id: planId,
        officeId: { in: officeIds },
      },
      select: {
        id: true,
        officeId: true,
        status: true,
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found.');
    }

    return plan;
  }

  private async getPlanScope(planId: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        officeId: true,
        status: true,
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found.');
    }

    return plan;
  }

  private async getGoalScope(planId: string, goalId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: {
        id: goalId,
        planId,
      },
      select: {
        id: true,
        officeId: true,
        plan: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found.');
    }

    return goal;
  }

  private ensureCanManagePlan(
    user: AuthenticatedUser,
    officeId: string,
    planStatus: string,
  ) {
    if (planStatus !== 'DRAFT') {
      throw new ForbiddenException('Only draft plans can be changed.');
    }

    if (user.role === 'ADMIN') {
      return;
    }

    if (!user.office?.id || user.office.id !== officeId) {
      throw new ForbiddenException(
        'You can only manage goals for your own office plan.',
      );
    }

  }
}
