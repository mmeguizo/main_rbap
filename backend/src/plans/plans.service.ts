import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OfficesService } from '../offices/offices.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreatePlanDto } from './dto/create-plan.dto';
import { QueryPlanDashboardDto } from './dto/query-plan-dashboard.dto';
import { QueryPlansDto } from './dto/query-plans.dto';
import { QueryPlanReportsDto } from './dto/query-plan-reports.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { UpdatePlanMonitoringDto } from './dto/update-plan-monitoring.dto';
import { CreatePlanRemarkDto } from './dto/create-plan-remark.dto';
import { QueryRemarksDto } from '../remarks/dto/query-remarks.dto';

const planSelect = {
  id: true,
  officeId: true,
  planningYear: true,
  campus: true,
  programProjectActivityKRA: true,
  strategicAlignment: true,
  breakthroughGoals: true,
  strategicObjectives: true,
  datePrepared: true,
  monitoringFrequency: true,
  reportingOffice: true,
  status: true,
  submittedAt: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
  office: {
    select: {
      id: true,
      name: true,
      parentId: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      supervisor: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      },
    },
  },
  _count: {
    select: {
      goals: true,
    },
  },
} as const;

const planRemarkSelect = {
  id: true,
  planId: true,
  content: true,
  createdAt: true,
  author: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} as const;

const dashboardPlanSelect = {
  id: true,
  officeId: true,
  planningYear: true,
  status: true,
  submittedAt: true,
  createdAt: true,
  createdBy: {
    select: {
      supervisorId: true,
    },
  },
  office: {
    select: {
      id: true,
      name: true,
    },
  },
  goals: {
    select: {
      objectives: {
        select: {
          status: true,
        },
      },
    },
  },
} as const;

type ObjectiveMetrics = {
  totalObjectives: number;
  completedObjectives: number;
  achievementRate: number;
};

export function calculateObjectiveMetrics(
  objectives: readonly { status: string }[],
): ObjectiveMetrics {
  const totalObjectives = objectives.length;
  const completedObjectives = objectives.filter(
    (objective) => objective.status === 'COMPLETED',
  ).length;

  return {
    totalObjectives,
    completedObjectives,
    achievementRate:
      totalObjectives === 0
        ? 0
        : Math.round((completedObjectives / totalObjectives) * 10000) / 100,
  };
}

export function calculateNeedsAttention(
  hasPlan: boolean,
  draftPlans: number,
  achievementRate: number,
): boolean {
  return !hasPlan || draftPlans > 0 || achievementRate < 100;
}

const planDocumentSelect = {
  id: true,
  officeId: true,
  planningYear: true,
  campus: true,
  programProjectActivityKRA: true,
  strategicAlignment: true,
  breakthroughGoals: true,
  strategicObjectives: true,
  datePrepared: true,
  monitoringFrequency: true,
  reportingOffice: true,
  status: true,
  submittedAt: true,
  approvedAt: true,
  office: { select: { id: true, name: true, parentId: true } },
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  planRemarks: {
    orderBy: { createdAt: 'desc' as const },
    take: 20,
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
  },
  monitoring: {
    select: {
      id: true,
      frequency: true,
      reportingOffice: true,
      preparedBy: true,
      reviewedBy: true,
      approvedBy: true,
      preparedAt: true,
      reviewedAt: true,
      approvedAt: true,
    },
  },
  goals: {
    orderBy: [{ displayOrder: 'asc' as const }, { createdAt: 'asc' as const }],
    select: {
      id: true,
      code: true,
      displayOrder: true,
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
      status: true,
      objectives: {
        orderBy: [{ displayOrder: 'asc' as const }, { createdAt: 'asc' as const }],
        select: {
          id: true,
          code: true,
          displayOrder: true,
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
          status: true,
        },
      },
    },
  },
};

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  private readonly creatorRoles = new Set([
    'ADMIN',
    'OFFICE_HEAD',
    'DIRECTORS',
    'VICE_PRESIDENTS',
    'PRESIDENTS',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly officesService: OfficesService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async create(dto: CreatePlanDto, user: AuthenticatedUser) {
    this.ensureCreatorRole(user);
    const officeId = this.getRequiredOfficeId(user);

    const existingPlan = await this.prisma.plan.findUnique({
      where: {
        officeId_planningYear: {
          officeId,
          planningYear: dto.planningYear,
        },
      },
      select: { id: true },
    });

    if (existingPlan) {
      throw new BadRequestException(
        'A plan for this office and planning year already exists.',
      );
    }

    const plan = await this.prisma.plan.create({
      data: {
        officeId,
        createdById: user.id,
        planningYear: dto.planningYear,
        campus: dto.campus,
        programProjectActivityKRA: dto.programProjectActivityKRA,
        strategicAlignment: dto.strategicAlignment,
        breakthroughGoals: dto.breakthroughGoals,
        strategicObjectives: dto.strategicObjectives,
        datePrepared: dto.datePrepared ? new Date(dto.datePrepared) : undefined,
        monitoringFrequency: dto.monitoringFrequency ?? 'Quarterly',
        reportingOffice: dto.reportingOffice,
      },
      select: planSelect,
    });

    const adminUsers = await this.prisma.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
    });

    const recipientUsers = adminUsers.filter((u) => u.id !== user.id);

    if (recipientUsers.length > 0) {
      await this.prisma.notification.createMany({
        data: recipientUsers.map((u) => ({
          userId: u.id,
          title: 'New Plan Created',
          message: `${plan.office.name} has created a new plan for year ${plan.planningYear}.`,
          type: 'INFO' as const,
          link: `/plans?plan=${plan.id}`,
        })),
      });
    }

    await this.activityLogService.log(
      user.id,
      'PLAN_CREATED',
      'Plan',
      plan.id,
      { officeName: plan.office.name, planningYear: plan.planningYear },
    );

    this.logger.log(`Plan created: ${plan.id} for office ${plan.office.id} year ${plan.planningYear}`);
    return plan;
  }

  async findAll(user: AuthenticatedUser, query: QueryPlansDto) {
    const { take = 20, skip = 0, officeId, planningYear, status, search } = query;
    const officeIds = await this.officesService.getAccessibleOfficeIds(user);

    if (officeIds.length === 0) {
      return { data: [], meta: { total: 0, take, skip, returned: 0 } };
    }

    if (officeId && !officeIds.includes(officeId)) {
      throw new ForbiddenException('You cannot filter plans for that office.');
    }

    const where = {
      officeId: { in: officeId ? [officeId] : officeIds },
      ...(planningYear !== undefined && { planningYear }),
      ...(status !== undefined && { status }),
      ...(search && {
        OR: [
          { programProjectActivityKRA: { contains: search, mode: 'insensitive' as const } },
          { campus: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.plan.findMany({
        where,
        take,
        skip,
        orderBy: [{ planningYear: 'desc' }, { createdAt: 'desc' }],
        select: planSelect,
      }),
      this.prisma.plan.count({ where }),
    ]);

    const budgetMap = await this.getBudgetTotalsByPlanId(data.map((p) => p.id));
    const enriched = data.map((plan) => ({
      ...plan,
      budgetRequirements: budgetMap.get(plan.id)?.budgetRequirements ?? 0,
      budgetAllocation: budgetMap.get(plan.id)?.budgetAllocation ?? 0,
    }));

    return {
      data: enriched,
      meta: { total, take, skip, returned: data.length },
    };
  }

  async getSummary(user: AuthenticatedUser, query: QueryPlanDashboardDto) {
    this.ensureRbapWorkspace(user);
    const { officeId, planningYear } = query;
    const officeIds = await this.officesService.getAccessibleOfficeIds(user);

    if (officeIds.length === 0) {
      return {
        filters: {
          officeId: officeId ?? null,
          planningYear: planningYear ?? null,
        },
        overview: {
          totalPlans: 0,
          draftPlans: 0,
          submittedPlans: 0,
          approvedPlans: 0,
          pendingApprovalCount: 0,
          totalObjectives: 0,
          completedObjectives: 0,
          achievementRate: 0,
          submissionRate: 0,
          needsAttentionCount: 0,
        },
        byOffice: [],
        byYear: [],
      };
    }

    if (officeId && !officeIds.includes(officeId)) {
      throw new ForbiddenException('You cannot filter plans for that office.');
    }

    const filteredOfficeIds = officeId ? [officeId] : officeIds;
    const where = {
      officeId: { in: filteredOfficeIds },
      ...(planningYear !== undefined && { planningYear }),
    };

    const plans = await this.prisma.plan.findMany({
      where,
      select: dashboardPlanSelect,
      orderBy: [{ planningYear: 'desc' }, { createdAt: 'desc' }],
    });
    const accessibleOffices =
      typeof (this.officesService as { findAccessibleOffices?: unknown })
        .findAccessibleOffices === 'function'
        ? await this.officesService.findAccessibleOffices(user)
        : plans.reduce(
            (offices, plan) => {
              if (!offices.some((office) => office.id === plan.office.id)) {
                offices.push(plan.office);
              }
              return offices;
            },
            [] as Array<{ id: string; name: string }>,
          );
    const offices = officeId
      ? accessibleOffices.filter((office) => office.id === officeId)
      : accessibleOffices;

    const pendingApprovalCount = plans.filter(
      (plan) =>
        plan.status === 'SUBMITTED' &&
        plan.createdBy.supervisorId === user.id,
    ).length;

    const byOfficeMap = new Map<
      string,
      {
        officeId: string;
        officeName: string;
        totalPlans: number;
        draftPlans: number;
        submittedPlans: number;
        approvedPlans: number;
        submissionRate: number;
        submissionStatus: string;
        totalObjectives: number;
        completedObjectives: number;
        achievementRate: number;
        targetAchievement: number;
        needsAttention: boolean;
      }
    >();
    const byYearMap = new Map<
      number,
      {
        planningYear: number;
        totalPlans: number;
        draftPlans: number;
        submittedPlans: number;
        approvedPlans: number;
        totalObjectives: number;
        completedObjectives: number;
      }
    >();

    for (const office of offices) {
      byOfficeMap.set(office.id, {
        officeId: office.id,
        officeName: office.name,
        totalPlans: 0,
        draftPlans: 0,
        submittedPlans: 0,
        approvedPlans: 0,
        submissionRate: 0,
        submissionStatus: 'NO_PLAN',
        totalObjectives: 0,
        completedObjectives: 0,
        achievementRate: 0,
        targetAchievement: 0,
        needsAttention: true,
      });
    }

    for (const plan of plans) {
      const metrics = calculateObjectiveMetrics(
        (plan.goals ?? []).flatMap((goal) => goal.objectives),
      );
      const officeEntry = byOfficeMap.get(plan.officeId) ?? {
        officeId: plan.office.id,
        officeName: plan.office.name,
        totalPlans: 0,
        draftPlans: 0,
        submittedPlans: 0,
        approvedPlans: 0,
        submissionRate: 0,
        submissionStatus: 'NO_PLAN',
        totalObjectives: 0,
        completedObjectives: 0,
        achievementRate: 0,
        targetAchievement: 0,
        needsAttention: true,
      };

      officeEntry.totalPlans += 1;
      if (plan.status === 'DRAFT') officeEntry.draftPlans += 1;
      if (plan.status === 'SUBMITTED') officeEntry.submittedPlans += 1;
      if (plan.status === 'APPROVED') officeEntry.approvedPlans += 1;
      officeEntry.totalObjectives += metrics.totalObjectives;
      officeEntry.completedObjectives += metrics.completedObjectives;
      byOfficeMap.set(plan.officeId, officeEntry);

      const yearEntry = byYearMap.get(plan.planningYear) ?? {
        planningYear: plan.planningYear,
        totalPlans: 0,
        draftPlans: 0,
        submittedPlans: 0,
        approvedPlans: 0,
        totalObjectives: 0,
        completedObjectives: 0,
      };

      yearEntry.totalPlans += 1;
      if (plan.status === 'DRAFT') yearEntry.draftPlans += 1;
      if (plan.status === 'SUBMITTED') yearEntry.submittedPlans += 1;
      if (plan.status === 'APPROVED') yearEntry.approvedPlans += 1;
      yearEntry.totalObjectives += metrics.totalObjectives;
      yearEntry.completedObjectives += metrics.completedObjectives;
      byYearMap.set(plan.planningYear, yearEntry);
    }

    for (const officeEntry of byOfficeMap.values()) {
      officeEntry.submissionRate =
        officeEntry.totalPlans === 0
          ? 0
          : Math.round(
              ((officeEntry.submittedPlans + officeEntry.approvedPlans) /
                officeEntry.totalPlans) *
                10000,
            ) / 100;
      officeEntry.submissionStatus =
        officeEntry.totalPlans === 0
          ? 'NO_PLAN'
          : officeEntry.draftPlans > 0
            ? 'PARTIAL'
            : 'SUBMITTED';
      officeEntry.achievementRate =
        officeEntry.totalObjectives === 0
          ? 0
          : Math.round(
              (officeEntry.completedObjectives / officeEntry.totalObjectives) *
                10000,
            ) / 100;
      officeEntry.targetAchievement = officeEntry.achievementRate;
      officeEntry.needsAttention = calculateNeedsAttention(
        officeEntry.totalPlans > 0,
        officeEntry.draftPlans,
        officeEntry.achievementRate,
      );
    }

    const budgetMap = await this.getBudgetTotalsByPlanId(
      plans.map((p) => p.id),
    );
    const totalBudgetRequirements = Array.from(budgetMap.values()).reduce(
      (sum, b) => sum + b.budgetRequirements,
      0,
    );
    const totalBudgetAllocation = Array.from(budgetMap.values()).reduce(
      (sum, b) => sum + b.budgetAllocation,
      0,
    );
    const totalObjectives = plans.reduce(
      (sum, plan) =>
        sum +
        (plan.goals ?? []).reduce(
          (goalSum, goal) => goalSum + goal.objectives.length,
          0,
        ),
      0,
    );
    const completedObjectives = plans.reduce(
      (sum, plan) =>
        sum +
        (plan.goals ?? []).reduce(
          (goalSum, goal) =>
            goalSum +
            goal.objectives.filter(
              (objective) => objective.status === 'COMPLETED',
            ).length,
          0,
        ),
      0,
    );
    const achievementRate =
      calculateObjectiveMetrics(
        plans.flatMap((plan) =>
          (plan.goals ?? []).flatMap((goal) => goal.objectives),
        ),
      ).achievementRate;
    const submissionRate =
      plans.length === 0
        ? 0
        : Math.round(
            ((plans.filter((plan) => plan.status !== 'DRAFT').length /
              plans.length) *
              10000),
          ) / 100;

    return {
      filters: {
        officeId: officeId ?? null,
        planningYear: planningYear ?? null,
      },
      overview: {
        totalPlans: plans.length,
        draftPlans: plans.filter((plan) => plan.status === 'DRAFT').length,
        submittedPlans: plans.filter((plan) => plan.status === 'SUBMITTED')
          .length,
        approvedPlans: plans.filter((plan) => plan.status === 'APPROVED')
          .length,
        pendingApprovalCount,
        budgetRequirements: totalBudgetRequirements,
        budgetAllocation: totalBudgetAllocation,
        totalObjectives,
        completedObjectives,
        achievementRate,
        submissionRate,
        needsAttentionCount: [...byOfficeMap.values()].filter(
          (office) => office.needsAttention,
        ).length,
      },
      byOffice: [...byOfficeMap.values()].sort((a, b) =>
        a.officeName.localeCompare(b.officeName),
      ),
      byYear: [...byYearMap.values()]
        .map((yearEntry) => ({
          ...yearEntry,
          submissionRate:
            yearEntry.totalPlans === 0
              ? 0
              : Math.round(
                  ((yearEntry.submittedPlans + yearEntry.approvedPlans) /
                    yearEntry.totalPlans) *
                    10000,
                ) / 100,
          achievementRate:
            yearEntry.totalObjectives === 0
              ? 0
              : Math.round(
                  (yearEntry.completedObjectives / yearEntry.totalObjectives) *
                    10000,
                ) / 100,
        }))
        .sort((a, b) => b.planningYear - a.planningYear),
    };
  }

  async getReports(user: AuthenticatedUser, query: QueryPlanReportsDto) {
    this.ensureRbapWorkspace(user);
    const { take = 20, skip = 0, officeId, planningYear, status } = query;
    const accessibleOfficeIds =
      await this.officesService.getAccessibleOfficeIds(user);

    if (officeId && !accessibleOfficeIds.includes(officeId)) {
      throw new ForbiddenException('You cannot filter plans for that office.');
    }

    if (accessibleOfficeIds.length === 0) {
      return { data: [], meta: { total: 0, take, skip, returned: 0 } };
    }

    const where = {
      officeId: { in: officeId ? [officeId] : accessibleOfficeIds },
      ...(planningYear !== undefined && { planningYear }),
      ...(status !== undefined && { status }),
    };

    const [plans, total] = await this.prisma.$transaction([
      this.prisma.plan.findMany({
        where,
        take,
        skip,
        orderBy: [{ planningYear: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          officeId: true,
          planningYear: true,
          status: true,
          submittedAt: true,
          office: { select: { id: true, name: true } },
          goals: {
            select: {
              objectives: {
                select: { status: true },
              },
            },
          },
        },
      }),
      this.prisma.plan.count({ where }),
    ]);

    const data = plans.map((plan) => {
      const metrics = calculateObjectiveMetrics(
        (plan.goals ?? []).flatMap((goal) => goal.objectives),
      );
      const submitted = plan.status !== 'DRAFT';

      return {
        id: plan.id,
        officeId: plan.officeId,
        office: plan.office,
        planningYear: plan.planningYear,
        status: plan.status,
        submittedAt: plan.submittedAt,
        submissionRate: submitted ? 100 : 0,
        submissionStatus: submitted ? 'SUBMITTED' : 'NOT_SUBMITTED',
        ...metrics,
        targetAchievement: metrics.achievementRate,
        needsAttention: calculateNeedsAttention(
          true,
          plan.status === 'DRAFT' ? 1 : 0,
          metrics.achievementRate,
        ),
      };
    });

    return {
      data,
      meta: { total, take, skip, returned: data.length },
    };
  }

  private ensureRbapWorkspace(user: AuthenticatedUser) {
    if (user.workspace === 'QM') {
      throw new ForbiddenException(
        'This endpoint is only available in the RBAP workspace.',
      );
    }
  }

  async findPendingApprovals(
    user: AuthenticatedUser,
    query: QueryPlanDashboardDto,
  ) {
    const { take = 20, skip = 0, officeId, planningYear } = query;
    const accessibleOfficeIds =
      await this.officesService.getAccessibleOfficeIds(user);

    if (officeId && !accessibleOfficeIds.includes(officeId)) {
      throw new ForbiddenException('You cannot filter plans for that office.');
    }

    const filteredOfficeIds = officeId
      ? accessibleOfficeIds.filter((id) => id === officeId)
      : accessibleOfficeIds;

    if (filteredOfficeIds.length === 0) {
      return { data: [], meta: { total: 0, take, skip, returned: 0 } };
    }

    const where = {
      officeId: { in: filteredOfficeIds },
      status: 'SUBMITTED' as const,
      createdBy: { supervisorId: user.id },
      ...(planningYear !== undefined && { planningYear }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.plan.findMany({
        where,
        take,
        skip,
        orderBy: [{ submittedAt: 'asc' }, { createdAt: 'desc' }],
        select: planSelect,
      }),
      this.prisma.plan.count({ where }),
    ]);

    const budgetMap = await this.getBudgetTotalsByPlanId(data.map((p) => p.id));
    const enriched = data.map((plan) => ({
      ...plan,
      budgetRequirements: budgetMap.get(plan.id)?.budgetRequirements ?? 0,
      budgetAllocation: budgetMap.get(plan.id)?.budgetAllocation ?? 0,
    }));

    return {
      data: enriched,
      meta: { total, take, skip, returned: data.length },
    };
  }

  async findOne(planId: string, user: AuthenticatedUser) {
    return this.findAccessiblePlan(planId, user);
  }

  async getDocument(planId: string, user: AuthenticatedUser) {
    const officeIds = await this.officesService.getAccessibleOfficeIds(user);
    if (officeIds.length === 0) throw new NotFoundException('Plan not found.');

    const document = await this.prisma.plan.findFirst({
      where: { id: planId, officeId: { in: officeIds } },
      select: planDocumentSelect,
    });
    if (!document) throw new NotFoundException('Plan not found.');
    return document;
  }

  async createRemark(
    planId: string,
    dto: CreatePlanRemarkDto,
    user: AuthenticatedUser,
  ) {
    const plan = await this.getPlanScope(planId);
    const canAccess = await this.officesService.canAccessOffice(
      user,
      plan.officeId,
    );
    if (!canAccess) {
      throw new ForbiddenException('You cannot access this plan.');
    }

    const remark = await this.prisma.planRemark.create({
      data: {
        planId,
        authorId: user.id,
        content: dto.content,
      },
      select: planRemarkSelect,
    });

    await this.activityLogService.log(
      user.id,
      'PLAN_REMARK_CREATED',
      'PlanRemark',
      remark.id,
      { planId },
    );

    return remark;
  }

  async findRemarks(
    planId: string,
    user: AuthenticatedUser,
    query: QueryRemarksDto,
  ) {
    await this.findAccessiblePlan(planId, user);
    const take = query.take ?? 20;
    const skip = query.skip ?? 0;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.planRemark.findMany({
        where: { planId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: planRemarkSelect,
      }),
      this.prisma.planRemark.count({ where: { planId } }),
    ]);

    return { data, meta: { total, take, skip, returned: data.length } };
  }

  async updateMonitoring(
    planId: string,
    dto: UpdatePlanMonitoringDto,
    user: AuthenticatedUser,
  ) {
    const plan = await this.getPlanScope(planId);
    this.ensureCanManagePlan(user, plan.officeId, plan.status);

    await this.prisma.$transaction(async (tx) => {
      await tx.planMonitoring.upsert({
        where: { planId },
        create: {
          planId,
          frequency: dto.frequency ?? 'Quarterly',
          reportingOffice: dto.reportingOffice,
          preparedBy: dto.preparedBy,
          reviewedBy: dto.reviewedBy,
          approvedBy: dto.approvedBy,
          preparedAt: dto.preparedAt ? new Date(dto.preparedAt) : undefined,
          reviewedAt: dto.reviewedAt ? new Date(dto.reviewedAt) : undefined,
          approvedAt: dto.approvedAt ? new Date(dto.approvedAt) : undefined,
        },
        update: {
          ...(dto.frequency !== undefined && { frequency: dto.frequency }),
          ...(dto.reportingOffice !== undefined && { reportingOffice: dto.reportingOffice }),
          ...(dto.preparedBy !== undefined && { preparedBy: dto.preparedBy }),
          ...(dto.reviewedBy !== undefined && { reviewedBy: dto.reviewedBy }),
          ...(dto.approvedBy !== undefined && { approvedBy: dto.approvedBy }),
          ...(dto.preparedAt !== undefined && { preparedAt: new Date(dto.preparedAt) }),
          ...(dto.reviewedAt !== undefined && { reviewedAt: new Date(dto.reviewedAt) }),
          ...(dto.approvedAt !== undefined && { approvedAt: new Date(dto.approvedAt) }),
        },
        select: { id: true },
      });
      await tx.plan.update({
        where: { id: planId },
        data: {
          ...(dto.frequency !== undefined && { monitoringFrequency: dto.frequency }),
          ...(dto.reportingOffice !== undefined && { reportingOffice: dto.reportingOffice }),
        },
        select: { id: true },
      });
    });

    await this.activityLogService.log(user.id, 'PLAN_MONITORING_UPDATED', 'Plan', planId, {});
    return this.getDocument(planId, user);
  }

  async update(planId: string, dto: UpdatePlanDto, user: AuthenticatedUser) {
    const plan = await this.getPlanScope(planId);
    this.ensureCanManagePlan(user, plan.officeId, plan.status);

    if (dto.planningYear !== undefined) {
      const duplicatePlan = await this.prisma.plan.findFirst({
        where: {
          officeId: plan.officeId,
          planningYear: dto.planningYear,
          NOT: { id: planId },
        },
        select: { id: true },
      });

      if (duplicatePlan) {
        throw new BadRequestException(
          'A plan for this office and planning year already exists.',
        );
      }
    }

    return this.prisma.plan.update({
      where: { id: planId },
      data: {
        ...(dto.planningYear !== undefined && {
          planningYear: dto.planningYear,
        }),
        ...(dto.campus !== undefined && { campus: dto.campus }),
        ...(dto.programProjectActivityKRA !== undefined && {
          programProjectActivityKRA: dto.programProjectActivityKRA,
        }),
        ...(dto.strategicAlignment !== undefined && {
          strategicAlignment: dto.strategicAlignment,
        }),
        ...(dto.breakthroughGoals !== undefined && {
          breakthroughGoals: dto.breakthroughGoals,
        }),
        ...(dto.strategicObjectives !== undefined && {
          strategicObjectives: dto.strategicObjectives,
        }),
        ...(dto.datePrepared !== undefined && {
          datePrepared: new Date(dto.datePrepared),
        }),
        ...(dto.monitoringFrequency !== undefined && {
          monitoringFrequency: dto.monitoringFrequency,
        }),
        ...(dto.reportingOffice !== undefined && {
          reportingOffice: dto.reportingOffice,
        }),
      },
      select: planSelect,
    });
  }

  async delete(planId: string, user: AuthenticatedUser) {
    const plan = await this.getPlanScope(planId);
    this.ensureCanManagePlan(user, plan.officeId, plan.status);

    if (user.role !== 'ADMIN' && plan.status !== 'DRAFT') {
      throw new ForbiddenException(
        'Only draft plans can be deleted by the owning office.',
      );
    }

    await this.activityLogService.log(user.id, 'PLAN_DELETED', 'Plan', planId, {
      officeName: plan.office.name,
      planningYear: plan.planningYear,
    });

    return this.prisma.plan.delete({
      where: { id: planId },
      select: planSelect,
    });
  }

  async submit(planId: string, user: AuthenticatedUser) {
    const plan = await this.getPlanScope(planId);
    this.ensureCanManagePlan(user, plan.officeId, plan.status);

    if (plan.status !== 'DRAFT') {
      throw new BadRequestException('Only draft plans can be submitted.');
    }

    const updatedPlan = await this.prisma.$transaction(async (tx) => {
      const planUpdate = await tx.plan.update({
        where: { id: planId },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
        },
        select: {
          id: true,
          officeId: true,
          office: { select: { name: true } },
        },
      });

      const approver = plan.createdBy.supervisorId
        ? await tx.user.findUnique({
            where: { id: plan.createdBy.supervisorId },
            select: { id: true, role: true, status: true },
          })
        : null;

      if (
        !approver ||
        approver.status !== 'ACTIVE' ||
        !this.isValidApproverRole(plan.createdBy.role, approver.role)
      ) {
        throw new BadRequestException(
          'Assign an active, valid higher-level approver before submitting this plan.',
        );
      }

      await tx.notification.create({
        data: {
          userId: approver.id,
          title: 'Plan Submitted for Review',
          message: `${planUpdate.office.name} has submitted a plan for your review and approval.`,
          type: 'INFO' as const,
          link: `/plans?plan=${planId}`,
        },
      });

      return planUpdate;
    });

    await this.activityLogService.log(
      user.id,
      'PLAN_SUBMITTED',
      'Plan',
      planId,
      { officeName: updatedPlan.office.name },
    );

    this.logger.log(`Plan submitted: ${planId} by user ${user.id}`);
    return this.findAccessiblePlan(planId, user);
  }

  async approve(planId: string, user: AuthenticatedUser) {
    const plan = await this.getPlanScope(planId);

    if (plan.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted plans can be approved.');
    }

    await this.ensureAssignedApprover(plan, user);

    const updatedPlan = await this.prisma.$transaction(async (tx) => {
      const planUpdate = await tx.plan.update({
        where: { id: planId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
        },
        select: {
          id: true,
          officeId: true,
          createdById: true,
          office: { select: { name: true } },
        },
      });

      if (planUpdate.createdById) {
        await tx.notification.create({
          data: {
            userId: planUpdate.createdById,
            title: 'Plan Approved',
            message: `Your plan for ${planUpdate.office.name} has been approved.`,
            type: 'SUCCESS' as const,
            link: `/plans/${planId}/view`,
          },
        });
      }

      return planUpdate;
    });

    await this.activityLogService.log(
      user.id,
      'PLAN_APPROVED',
      'Plan',
      planId,
      { officeName: updatedPlan.office.name },
    );

    this.logger.log(`Plan approved: ${planId} by user ${user.id}`);
    return this.findAccessiblePlan(planId, user);
  }

  async returnPlan(
    planId: string,
    dto: CreatePlanRemarkDto,
    user: AuthenticatedUser,
  ) {
    const plan = await this.getPlanScope(planId);

    if (plan.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted plans can be returned.');
    }

    await this.ensureAssignedApprover(plan, user);

    await this.prisma.$transaction(async (tx) => {
      const remark = await tx.planRemark.create({
        data: {
          planId,
          authorId: user.id,
          content: dto.content,
        },
        select: planRemarkSelect,
      });

      const planUpdate = await tx.plan.update({
        where: { id: planId },
        data: {
          status: 'DRAFT',
          submittedAt: null,
          approvedAt: null,
        },
        select: {
          id: true,
          officeId: true,
          createdById: true,
          office: { select: { name: true } },
        },
      });

      await tx.notification.create({
        data: {
          userId: planUpdate.createdById,
          title: 'Plan Returned for Revision',
          message: `${user.name} returned your plan for ${planUpdate.office.name} for revision. Feedback: "${dto.content}"`,
          type: 'WARNING' as const,
          link: `/plans/${planId}/view`,
        },
      });

      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: 'PLAN_RETURNED',
          entity: 'Plan',
          entityId: planId,
          details: {
            officeName: planUpdate.office.name,
            remarkId: remark.id,
            content: dto.content,
          },
        },
      });

      return planUpdate;
    });

    this.logger.log(`Plan returned: ${planId} by user ${user.id}`);
    return this.findAccessiblePlan(planId, user);
  }

  private async getBudgetTotalsByPlanId(planIds: string[]) {
    if (planIds.length === 0) {
      return new Map<
        string,
        { budgetRequirements: number; budgetAllocation: number }
      >();
    }

    const result = await this.prisma.goal.groupBy({
      by: ['planId'],
      where: { planId: { in: planIds } },
      _sum: {
        budgetRequirements: true,
        budgetAllocation: true,
      },
    });

    const map = new Map<
      string,
      { budgetRequirements: number; budgetAllocation: number }
    >();
    for (const row of result) {
      map.set(row.planId, {
        budgetRequirements: Number(row._sum.budgetRequirements ?? 0),
        budgetAllocation: Number(row._sum.budgetAllocation ?? 0),
      });
    }
    return map;
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
      select: planSelect,
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
        planningYear: true,
        createdBy: {
          select: {
            id: true,
            role: true,
            supervisorId: true,
          },
        },
        office: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found.');
    }

    return plan;
  }

  private ensureCreatorRole(user: AuthenticatedUser) {
    if (!this.creatorRoles.has(user.role)) {
      throw new ForbiddenException('This role cannot create RBAP plans.');
    }
  }

  private isValidApproverRole(
    creatorRole: string,
    approverRole: string,
  ): boolean {
    const allowedRoles: Record<string, string[]> = {
      OFFICE_HEAD: ['DIRECTORS'],
      DIRECTORS: ['VICE_PRESIDENTS'],
      VICE_PRESIDENTS: ['ADMIN', 'PRESIDENTS'],
      PRESIDENTS: ['ADMIN'],
      ADMIN: [],
    };

    return allowedRoles[creatorRole]?.includes(approverRole) ?? false;
  }

  private async ensureAssignedApprover(
    plan: {
      officeId: string;
      createdBy: { supervisorId: string | null; role: string };
    },
    user: AuthenticatedUser,
  ) {
    const officeIds = await this.officesService.getAccessibleOfficeIds(user);
    if (Array.isArray(officeIds) && !officeIds.includes(plan.officeId)) {
      throw new ForbiddenException('You cannot access this plan.');
    }

    if (
      plan.createdBy.supervisorId !== user.id ||
      !this.isValidApproverRole(plan.createdBy.role, user.role)
    ) {
      throw new ForbiddenException(
        "Only the plan submitter's assigned supervisor can act on this plan.",
      );
    }
  }

  private ensureCanManagePlan(
    user: AuthenticatedUser,
    officeId: string,
    status: string,
  ) {
    if (status !== 'DRAFT') {
      throw new ForbiddenException('Only draft plans can be edited.');
    }

    if (user.role === 'ADMIN') {
      return;
    }

    const ownOfficeId = this.getRequiredOfficeId(user);

    if (officeId !== ownOfficeId) {
      throw new ForbiddenException(
        'You can only manage plans for your own office.',
      );
    }

  }

  private getRequiredOfficeId(user: AuthenticatedUser) {
    if (!user.office?.id) {
      throw new ForbiddenException(
        'Assign this user to an office before creating or managing plans.',
      );
    }

    return user.office.id;
  }
}
