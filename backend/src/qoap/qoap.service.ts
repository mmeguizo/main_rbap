import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OfficesService } from '../offices/offices.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { isQmOrAdmin } from '../common/qm-office';
import { CreateQoapDto } from './dto/create-qoap.dto';
import { UpdateQoapDto } from './dto/update-qoap.dto';
import { QueryQoapDto } from './dto/query-qoap.dto';

const qoapSelect = {
  id: true,
  goalId: true,
  officeId: true,
  createdById: true,
  functionalObjective: true,
  indicators: true,
  indicatorFormula: true,
  resources: true,
  monitoringFrequency: true,
  intendedOutcomes: true,
  createdAt: true,
  updatedAt: true,
  office: {
    select: {
      id: true,
      name: true,
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
  // RBAP context is read through the Goal -> Plan relation; never copied.
  // QOAP document column -> source:
  //   Breakthrough goals / strategic objectives -> goal.plan.breakthroughGoals / goal.plan.strategicObjectives
  //   Indicators                            -> goal.keyPerformanceIndicator
  //   Actions                               -> goal.keyActions
  //   Targets                               -> goal.target
  //   Target completion                     -> goal.timeline
  //   Responsible persons                   -> goal.responsibleOfficePerson
  //   Fund/budget/MOV                       -> goal.fundSource, goal.budgetRequirements, goal.budgetAllocation, goal.meansOfVerification
  //   QM-only columns                       -> Qoap fields
  goal: {
    select: {
      id: true,
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
      meansOfVerification: true,
      status: true,
      objectives: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          resultLevel: true,
          targetResult: true,
          keyActions: true,
          keyPerformanceIndicator: true,
          target: true,
          timeline: true,
          status: true,
        },
      },
      plan: {
        select: {
          id: true,
          planningYear: true,
          campus: true,
          programProjectActivityKRA: true,
          strategicAlignment: true,
          reportingOffice: true,
          monitoringFrequency: true,
          breakthroughGoals: true,
          strategicObjectives: true,
          status: true,
        },
      },
    },
  },
  qoms: {
    orderBy: { monitoringNo: 'asc' },
    select: {
      id: true,
      monitoringNo: true,
      recencyDate: true,
      previousMonitoringDate: true,
      performance: true,
      overallDataResult: true,
      movDataSource: true,
    },
  },
} as const;

const qoapSummarySelect = {
  id: true,
  goalId: true,
  officeId: true,
  functionalObjective: true,
  indicators: true,
  indicatorFormula: true,
  resources: true,
  monitoringFrequency: true,
  intendedOutcomes: true,
  createdAt: true,
  updatedAt: true,
  office: {
    select: {
      id: true,
      name: true,
    },
  },
  goal: {
    select: {
      id: true,
      resultLevel: true,
      targetResult: true,
      keyActions: true,
      keyPerformanceIndicator: true,
      target: true,
      responsibleOfficePerson: true,
      timeline: true,
      objectives: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          resultLevel: true,
          targetResult: true,
          keyActions: true,
          keyPerformanceIndicator: true,
          target: true,
          timeline: true,
          status: true,
        },
      },
      plan: {
        select: {
          id: true,
          planningYear: true,
          reportingOffice: true,
          monitoringFrequency: true,
          breakthroughGoals: true,
          strategicObjectives: true,
        },
      },
    },
  },
  _count: {
    select: {
      qoms: true,
    },
  },
} as const;

const availableGoalSelect = {
  id: true,
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
  meansOfVerification: true,
  status: true,
  plan: {
    select: {
      id: true,
      planningYear: true,
      campus: true,
      programProjectActivityKRA: true,
      strategicAlignment: true,
      reportingOffice: true,
      monitoringFrequency: true,
      breakthroughGoals: true,
      strategicObjectives: true,
    },
  },
  office: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

@Injectable()
export class QoapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly officesService: OfficesService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async create(dto: CreateQoapDto, user: AuthenticatedUser) {
    this.ensureCanMutate(user);

    const goal = await this.prisma.goal.findUnique({
      where: { id: dto.goalId },
      select: {
        id: true,
        officeId: true,
        keyActions: true,
        plan: { select: { status: true, monitoringFrequency: true } },
      },
    });
    if (!goal) {
      throw new NotFoundException('Goal not found.');
    }
    if (goal.plan.status !== 'APPROVED') {
      throw new BadRequestException(
        'A QOAP can only be created from an approved RBAP plan.',
      );
    }
    const accessibleOfficeIds = await this.getQoapOfficeIds(user);
    if (!accessibleOfficeIds.includes(goal.officeId)) {
      throw new ForbiddenException(
        'You cannot create a QOAP for an office outside your scope.',
      );
    }

    const existing = await this.prisma.qoap.findUnique({
      where: { goalId: dto.goalId },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        'A QOAP already exists for this Goal. Each Goal can have at most one QOAP.',
      );
    }

    const qoap = await this.prisma.qoap
      .create({
        data: {
          goalId: dto.goalId,
          officeId: goal.officeId,
          createdById: user.id,
          functionalObjective: dto.functionalObjective,
          indicators: dto.indicators,
          indicatorFormula: dto.indicatorFormula,
          resources: dto.resources,
          monitoringFrequency: this.toQomFrequency(
            goal.plan.monitoringFrequency,
          ),
          intendedOutcomes: dto.intendedOutcomes,
        },
        select: qoapSelect,
      })
      .catch((e: unknown) => {
        if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new BadRequestException(
            'A QOAP already exists for this Goal. Each Goal can have at most one QOAP.',
          );
        }
        throw e;
      });

    await this.activityLogService.log(
      user.id,
      'QOAP_CREATED',
      'Qoap',
      qoap.id,
      {
        goalId: dto.goalId,
        officeId: goal.officeId,
      },
    );

    return qoap;
  }

  async findAvailableGoals(user: AuthenticatedUser, query: QueryQoapDto) {
    const { take = 20, skip = 0, officeId, planningYear } = query;
    const officeIds = await this.getQoapOfficeIds(user);

    if (officeIds.length === 0) {
      return { data: [], meta: { total: 0, take, skip, returned: 0 } };
    }

    if (officeId && !officeIds.includes(officeId)) {
      throw new ForbiddenException('You cannot filter goals for that office.');
    }

    const where = {
      officeId: { in: officeId ? [officeId] : officeIds },
      qoap: null,
      plan: {
        status: 'APPROVED' as const,
        ...(planningYear !== undefined && { planningYear }),
      },
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.goal.findMany({
        where,
        take,
        skip,
        orderBy: [{ plan: { planningYear: 'desc' } }, { createdAt: 'asc' }],
        select: availableGoalSelect,
      }),
      this.prisma.goal.count({ where }),
    ]);

    return { data, meta: { total, take, skip, returned: data.length } };
  }

  async findAll(user: AuthenticatedUser, query: QueryQoapDto) {
    const { take = 20, skip = 0, officeId, planningYear } = query;

    const officeIds = await this.getQoapOfficeIds(user);

    if (officeIds.length === 0) {
      return { data: [], meta: { total: 0, take, skip, returned: 0 } };
    }

    if (officeId && !officeIds.includes(officeId)) {
      throw new ForbiddenException('You cannot filter QOAPs for that office.');
    }

    const where = {
      officeId: { in: officeId ? [officeId] : officeIds },
      ...(planningYear !== undefined && {
        goal: { plan: { planningYear } },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.qoap.findMany({
        where,
        take,
        skip,
        orderBy: [
          { goal: { plan: { planningYear: 'desc' } } },
          { createdAt: 'desc' },
        ],
        select: qoapSummarySelect,
      }),
      this.prisma.qoap.count({ where }),
    ]);

    return { data, meta: { total, take, skip, returned: data.length } };
  }

  async findOne(qoapId: string, user: AuthenticatedUser) {
    return this.findAccessibleQoap(qoapId, user, qoapSelect);
  }

  async update(qoapId: string, dto: UpdateQoapDto, user: AuthenticatedUser) {
    this.ensureCanMutate(user);
    const qoap = await this.assertCanAccessQoap(qoapId, user);

    try {
      const updated = await this.prisma.qoap.update({
        where: { id: qoapId },
        data: {
          ...(dto.functionalObjective !== undefined && {
            functionalObjective: dto.functionalObjective,
          }),
          ...(dto.indicators !== undefined && { indicators: dto.indicators }),
          ...(dto.indicatorFormula !== undefined && {
            indicatorFormula: dto.indicatorFormula,
          }),
          ...(dto.resources !== undefined && { resources: dto.resources }),
          ...(dto.intendedOutcomes !== undefined && {
            intendedOutcomes: dto.intendedOutcomes,
          }),
        },
        select: qoapSelect,
      });

      await this.activityLogService.log(
        user.id,
        'QOAP_UPDATED',
        'Qoap',
        qoapId,
        {
          goalId: qoap.goalId,
          officeId: qoap.officeId,
        },
      );

      return updated;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('QOAP not found');
      }
      throw e;
    }
  }

  async delete(qoapId: string, user: AuthenticatedUser) {
    this.ensureCanMutate(user);
    const qoap = await this.assertCanAccessQoap(qoapId, user);

    try {
      const deleted = await this.prisma.qoap.delete({
        where: { id: qoapId },
        select: qoapSelect,
      });

      await this.activityLogService.log(
        user.id,
        'QOAP_DELETED',
        'Qoap',
        qoapId,
        {
          goalId: qoap.goalId,
          officeId: qoap.officeId,
        },
      );

      return deleted;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('QOAP not found');
      }
      throw e;
    }
  }

  private ensureCanMutate(user: AuthenticatedUser) {
    if (!isQmOrAdmin(user)) {
      throw new ForbiddenException(
        'Only Quality Management office members or ADMIN can manage QOAP records.',
      );
    }
  }

  private async getQoapOfficeIds(user: AuthenticatedUser): Promise<string[]> {
    if (user.workspace === 'QM') {
      const offices = await this.prisma.office.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });
      return offices.map((office) => office.id);
    }

    return this.officesService.getAccessibleOfficeIds(user);
  }

  private toQomFrequency(value: string) {
    const normalized = value.trim().toUpperCase();
    const frequencies = {
      MONTHLY: 'MONTHLY',
      QUARTERLY: 'QUARTERLY',
      BIANNUAL: 'BIANNUAL',
      BIANNUALLY: 'BIANNUAL',
      ANNUAL: 'ANNUAL',
      ANNUALLY: 'ANNUAL',
    } as const;
    const frequency = frequencies[normalized as keyof typeof frequencies];

    if (!frequency) {
      throw new BadRequestException(
        `Unsupported RBAP monitoring frequency: ${value}`,
      );
    }

    return frequency;
  }

  private async getQoapScope(qoapId: string) {
    const qoap = await this.prisma.qoap.findUnique({
      where: { id: qoapId },
      select: { id: true, goalId: true, officeId: true },
    });

    if (!qoap) {
      throw new NotFoundException('QOAP not found.');
    }

    return qoap;
  }

  private async findAccessibleQoap(
    qoapId: string,
    user: AuthenticatedUser,
    select: typeof qoapSelect,
  ) {
    const officeIds = await this.getQoapOfficeIds(user);

    if (officeIds.length === 0) {
      throw new NotFoundException('QOAP not found.');
    }

    const qoap = await this.prisma.qoap.findFirst({
      where: {
        id: qoapId,
        officeId: { in: officeIds },
      },
      select,
    });

    if (!qoap) {
      throw new NotFoundException('QOAP not found.');
    }

    return qoap;
  }

  private async assertCanAccessQoap(qoapId: string, user: AuthenticatedUser) {
    const qoap = await this.getQoapScope(qoapId);
    const officeIds = await this.getQoapOfficeIds(user);

    if (!officeIds.includes(qoap.officeId)) {
      throw new NotFoundException('QOAP not found.');
    }

    return qoap;
  }
}
