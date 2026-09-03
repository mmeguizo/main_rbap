import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryActivityLogDto } from './dto/query-activity-log.dto';

const activityLogSelect = {
  id: true,
  action: true,
  entity: true,
  entityId: true,
  details: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
};

export type ActivityLogDto = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  details: unknown;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    userId: string,
    action: string,
    entity: string,
    entityId: string,
    details?: unknown,
  ): Promise<void> {
    await this.prisma.activityLog.create({
      data: details
        ? { userId, action, entity, entityId, details }
        : { userId, action, entity, entityId },
    });
  }

  async findAll(
    query: QueryActivityLogDto,
  ) {
    const take = query.take ?? 20;
    const skip = query.skip ?? 0;

    const where: {
      userId?: string;
      action?: string;
      entity?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};

    if (query.userId) where.userId = query.userId;

    if (query.action) where.action = query.action;
    if (query.entity) where.entity = query.entity;

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: activityLogSelect,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return { data, total, take, skip };
  }
}
