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
import { CreateObjectiveDto } from './dto/create-objective.dto';
import { QueryObjectivesDto } from './dto/query-objectives.dto';
import { UpdateObjectiveDto } from './dto/update-objective.dto';
import { UpdateObjectiveProgressDto } from './dto/update-objective-progress.dto';

const objectiveSelect = {
  id: true,
  goalId: true,
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
  goal: {
    select: {
      id: true,
      planId: true,
      resultLevel: true,
      office: {
        select: {
          id: true,
          name: true,
        },
      },
      plan: {
        select: {
          planningYear: true,
          status: true,
        },
      },
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
} as const;

@Injectable()
export class ObjectivesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly officesService: OfficesService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async create(
    planId: string,
    goalId: string,
    dto: CreateObjectiveDto,
    user: AuthenticatedUser,
  ) {
    const goal = await this.getGoalScope(planId, goalId);
    this.ensureCanManagePlan(user, goal.officeId, goal.plan.status);

    const objective = await this.prisma.objective.create({
      data: {
        goalId,
        createdById: user.id,
        resultLevel: dto.resultLevel,
        targetResult: dto.targetResult ?? '',
        keyActions: dto.keyActions ?? '',
        keyRisk: dto.keyRisk ?? '',
        mitigationMeasures: dto.mitigationMeasures ?? '',
        keyPerformanceIndicator: dto.keyPerformanceIndicator ?? '',
        target: dto.target ?? '',
        responsibleOfficePerson: dto.responsibleOfficePerson ?? '',
        timeline: dto.timeline ?? '',
        fundSource: dto.fundSource,
        budgetRequirements: dto.budgetRequirements ?? 0,
        budgetAllocation: dto.budgetAllocation ?? 0,
        budgetDeficit: dto.budgetDeficit ?? 0,
        meansOfVerification: dto.meansOfVerification ?? '',
        code: dto.code ?? dto.resultLevel,
        displayOrder: dto.displayOrder ?? 0,
      },
      select: objectiveSelect,
    });

    await this.activityLogService.log(
      user.id,
      'OBJECTIVE_CREATED',
      'Objective',
      objective.id,
      { goalId, resultLevel: dto.resultLevel },
    );

    return objective;
  }

  async findAll(
    planId: string,
    goalId: string,
    user: AuthenticatedUser,
    take = 20,
    skip = 0,
  ) {
    await this.findAccessibleGoal(planId, goalId, user);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.objective.findMany({
        where: { goalId },
        take,
        skip,
        orderBy: [{ createdAt: 'asc' }, { resultLevel: 'asc' }],
        select: objectiveSelect,
      }),
      this.prisma.objective.count({ where: { goalId } }),
    ]);

    return { data, meta: { total, take, skip, returned: data.length } };
  }

  async findAllVisible(user: AuthenticatedUser, query: QueryObjectivesDto) {
    const {
      take = 20,
      skip = 0,
      officeId,
      planId,
      goalId,
      planningYear,
      status,
      search,
    } = query;
    const officeIds = await this.officesService.getAccessibleOfficeIds(user);

    if (officeIds.length === 0) {
      return { data: [], meta: { total: 0, take, skip, returned: 0 } };
    }

    if (officeId && !officeIds.includes(officeId)) {
      throw new ForbiddenException(
        'You cannot filter objectives for that office.',
      );
    }

    const where = {
      goal: {
        officeId: { in: officeId ? [officeId] : officeIds },
        ...(planId !== undefined && { planId }),
        ...(planningYear !== undefined && { plan: { planningYear } }),
      },
      ...(goalId !== undefined && { goalId }),
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
      this.prisma.objective.findMany({
        where,
        take,
        skip,
        orderBy: [
          { goal: { plan: { planningYear: 'desc' } } },
          { createdAt: 'asc' },
          { resultLevel: 'asc' },
        ],
        select: objectiveSelect,
      }),
      this.prisma.objective.count({ where }),
    ]);

    return { data, meta: { total, take, skip, returned: data.length } };
  }

  async findOneVisible(objectiveId: string, user: AuthenticatedUser) {
    const officeIds = await this.officesService.getAccessibleOfficeIds(user);

    if (officeIds.length === 0) {
      throw new NotFoundException('Objective not found.');
    }

    const objective = await this.prisma.objective.findFirst({
      where: {
        id: objectiveId,
        goal: {
          officeId: { in: officeIds },
        },
      },
      select: objectiveSelect,
    });

    if (!objective) {
      throw new NotFoundException('Objective not found.');
    }

    return objective;
  }

  async findOne(
    planId: string,
    goalId: string,
    objectiveId: string,
    user: AuthenticatedUser,
  ) {
    await this.findAccessibleGoal(planId, goalId, user);

    const objective = await this.prisma.objective.findFirst({
      where: { id: objectiveId, goalId },
      select: objectiveSelect,
    });

    if (!objective) {
      throw new NotFoundException('Objective not found.');
    }

    return objective;
  }

  async update(
    planId: string,
    goalId: string,
    objectiveId: string,
    dto: UpdateObjectiveDto,
    user: AuthenticatedUser,
  ) {
    const objective = await this.getObjectiveScope(planId, goalId, objectiveId);
    this.ensureCanManagePlan(
      user,
      objective.goal.officeId,
      objective.goal.plan.status,
    );

    try {
      const updated = await this.prisma.objective.update({
        where: { id: objectiveId },
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
        select: objectiveSelect,
      });

      await this.activityLogService.log(
        user.id,
        'OBJECTIVE_UPDATED',
        'Objective',
        objectiveId,
        { goalId },
      );

      return updated;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Objective not found');
      }

      throw e;
    }
  }

  async updateProgress(
    planId: string,
    goalId: string,
    objectiveId: string,
    dto: UpdateObjectiveProgressDto,
    user: AuthenticatedUser,
  ) {
    const objective = await this.getObjectiveScope(planId, goalId, objectiveId);
    this.ensureCanUpdateProgress(
      user,
      objective.goal.officeId,
      objective.goal.plan.status,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedObjective = await tx.objective.update({
        where: { id: objectiveId },
        data: { status: dto.status },
        select: objectiveSelect,
      });

      const objectives = await tx.objective.findMany({
        where: { goalId },
        select: { status: true },
      });
      const goalStatus =
        objectives.length === 0 ||
        objectives.every((item) => item.status === 'NOT_STARTED')
          ? 'NOT_STARTED'
          : objectives.every((item) => item.status === 'COMPLETED')
            ? 'COMPLETED'
            : 'IN_PROGRESS';

      await tx.goal.update({
        where: { id: goalId },
        data: { status: goalStatus },
      });

      return updatedObjective;
    });

    await this.activityLogService.log(
      user.id,
      'OBJECTIVE_PROGRESS_UPDATED',
      'Objective',
      objectiveId,
      { goalId, status: dto.status },
    );

    return updated;
  }

  async delete(
    planId: string,
    goalId: string,
    objectiveId: string,
    user: AuthenticatedUser,
  ) {
    const objective = await this.getObjectiveScope(planId, goalId, objectiveId);
    this.ensureCanManagePlan(
      user,
      objective.goal.officeId,
      objective.goal.plan.status,
    );

    try {
      const deleted = await this.prisma.objective.delete({
        where: { id: objectiveId },
        select: objectiveSelect,
      });

      await this.activityLogService.log(
        user.id,
        'OBJECTIVE_DELETED',
        'Objective',
        objectiveId,
        { goalId },
      );

      return deleted;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Objective not found');
      }
      throw e;
    }
  }

  private async findAccessibleGoal(
    planId: string,
    goalId: string,
    user: AuthenticatedUser,
  ) {
    const officeIds = await this.officesService.getAccessibleOfficeIds(user);

    if (officeIds.length === 0) {
      throw new NotFoundException('Goal not found.');
    }

    const goal = await this.prisma.goal.findFirst({
      where: {
        id: goalId,
        planId,
        officeId: { in: officeIds },
      },
      select: {
        id: true,
      },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found.');
    }

    return goal;
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

  private async getObjectiveScope(
    planId: string,
    goalId: string,
    objectiveId: string,
  ) {
    const objective = await this.prisma.objective.findFirst({
      where: {
        id: objectiveId,
        goalId,
        goal: {
          planId,
        },
      },
      select: {
        id: true,
        goal: {
          select: {
            officeId: true,
            plan: {
              select: {
                status: true,
              },
            },
          },
        },
      },
    });

    if (!objective) {
      throw new NotFoundException('Objective not found.');
    }

    return objective;
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
        'You can only manage objectives for your own office plan.',
      );
    }

  }

  private ensureCanUpdateProgress(
    user: AuthenticatedUser,
    officeId: string,
    planStatus: string,
  ) {
    if (planStatus !== 'APPROVED') {
      throw new ForbiddenException(
        'Progress updates are available only for approved plans.',
      );
    }

    if (user.role !== 'ADMIN' && user.office?.id !== officeId) {
      throw new ForbiddenException(
        'You can only update progress for your own office plan.',
      );
    }
  }
}
