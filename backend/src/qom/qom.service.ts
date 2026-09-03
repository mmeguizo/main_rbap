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
import { CreateQomDto } from './dto/create-qom.dto';
import { UpdateQomDto } from './dto/update-qom.dto';
import { QueryQomDto } from './dto/query-qom.dto';

const qomSelect = {
  id: true,
  qoapId: true,
  monitoringNo: true,
  recencyDate: true,
  previousMonitoringDate: true,
  performance: true,
  overallDataResult: true,
  movDataSource: true,
  createdAt: true,
  updatedAt: true,
  qoap: {
    select: {
      id: true,
      officeId: true,
      goalId: true,
    },
  },
} as const;

@Injectable()
export class QomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly officesService: OfficesService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async create(qoapId: string, dto: CreateQomDto, user: AuthenticatedUser) {
    this.ensureCanMutate(user);
    await this.assertCanReadQoap(qoapId, user);

    const existing = await this.prisma.qom.findUnique({
      where: {
        qoapId_monitoringNo: {
          qoapId,
          monitoringNo: dto.monitoringNo,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        `A QOM with monitoring number ${dto.monitoringNo} already exists for this QOAP.`,
      );
    }

    const qom = await this.prisma.qom.create({
      data: {
        qoapId,
        monitoringNo: dto.monitoringNo,
        recencyDate: new Date(dto.recencyDate),
        previousMonitoringDate: dto.previousMonitoringDate
          ? new Date(dto.previousMonitoringDate)
          : undefined,
        performance: dto.performance,
        overallDataResult: dto.overallDataResult,
        movDataSource: dto.movDataSource,
      },
      select: qomSelect,
    });

    await this.activityLogService.log(user.id, 'QOM_CREATED', 'Qom', qom.id, {
      qoapId,
      monitoringNo: dto.monitoringNo,
    });

    return qom;
  }

  async findAll(qoapId: string, user: AuthenticatedUser, query: QueryQomDto) {
    const { take = 20, skip = 0 } = query;
    await this.assertCanReadQoap(qoapId, user);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.qom.findMany({
        where: { qoapId },
        take,
        skip,
        orderBy: [{ monitoringNo: 'asc' }, { recencyDate: 'desc' }],
        select: qomSelect,
      }),
      this.prisma.qom.count({ where: { qoapId } }),
    ]);

    return { data, meta: { total, take, skip, returned: data.length } };
  }

  async findOne(qoapId: string, qomId: string, user: AuthenticatedUser) {
    await this.assertCanReadQoap(qoapId, user);

    const qom = await this.prisma.qom.findFirst({
      where: { id: qomId, qoapId },
      select: qomSelect,
    });

    if (!qom) {
      throw new NotFoundException('QOM not found.');
    }

    return qom;
  }

  async update(
    qoapId: string,
    qomId: string,
    dto: UpdateQomDto,
    user: AuthenticatedUser,
  ) {
    this.ensureCanMutate(user);
    await this.assertCanReadQoap(qoapId, user);
    const existingQom = await this.prisma.qom.findFirst({
      where: { id: qomId, qoapId },
      select: { id: true },
    });
    if (!existingQom) {
      throw new NotFoundException('QOM not found.');
    }

    try {
      const updated = await this.prisma.qom.update({
        where: { id: qomId },
        data: {
          ...(dto.monitoringNo !== undefined && {
            monitoringNo: dto.monitoringNo,
          }),
          ...(dto.recencyDate !== undefined && {
            recencyDate: new Date(dto.recencyDate),
          }),
          ...(dto.previousMonitoringDate !== undefined && {
            previousMonitoringDate: dto.previousMonitoringDate
              ? new Date(dto.previousMonitoringDate)
              : null,
          }),
          ...(dto.performance !== undefined && {
            performance: dto.performance,
          }),
          ...(dto.overallDataResult !== undefined && {
            overallDataResult: dto.overallDataResult,
          }),
          ...(dto.movDataSource !== undefined && {
            movDataSource: dto.movDataSource,
          }),
        },
        select: qomSelect,
      });

      await this.activityLogService.log(user.id, 'QOM_UPDATED', 'Qom', qomId, {
        qoapId,
        monitoringNo: updated.monitoringNo,
      });

      return updated;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('QOM not found');
      }
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException(
          'A QOM with this monitoring number already exists for this QOAP.',
        );
      }
      throw e;
    }
  }

  private ensureCanMutate(user: AuthenticatedUser) {
    if (!isQmOrAdmin(user)) {
      throw new ForbiddenException(
        'Only Quality Management office members or ADMIN can manage QOM records.',
      );
    }
  }

  private async getQoapScope(qoapId: string) {
    const qoap = await this.prisma.qoap.findUnique({
      where: { id: qoapId },
      select: { id: true, officeId: true },
    });

    if (!qoap) {
      throw new NotFoundException('QOAP not found.');
    }

    return qoap;
  }

  private async assertCanReadQoap(qoapId: string, user: AuthenticatedUser) {
    const qoap = await this.getQoapScope(qoapId);

    const officeIds = await this.getQomOfficeIds(user);
    if (officeIds.length === 0 || !officeIds.includes(qoap.officeId)) {
      throw new NotFoundException('QOAP not found.');
    }

    return qoap;
  }

  private async getQomOfficeIds(user: AuthenticatedUser): Promise<string[]> {
    if (user.workspace === 'QM') {
      const offices = await this.prisma.office.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });
      return offices.map((office) => office.id);
    }

    return this.officesService.getAccessibleOfficeIds(user);
  }
}
