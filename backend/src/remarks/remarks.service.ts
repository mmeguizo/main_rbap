import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OfficesService } from '../offices/offices.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateRemarkDto } from './dto/create-remark.dto';
import { QueryRemarksDto } from './dto/query-remarks.dto';
import { Role } from '@prisma/client';

const remarkSelect = {
  id: true,
  goalId: true,
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

const ROLE_HIERARCHY: Record<string, string> = {
  OFFICE_HEAD: 'DIRECTORS',
  DIRECTORS: 'VICE_PRESIDENTS',
  VICE_PRESIDENTS: 'PRESIDENTS',
};

@Injectable()
export class RemarksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly officesService: OfficesService,
    private readonly notificationsService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async create(
    goalId: string,
    user: AuthenticatedUser,
    dto: CreateRemarkDto,
  ) {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
      select: { id: true, officeId: true },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found.');
    }

    const canAccess = await this.officesService.canAccessOffice(user, goal.officeId);
    if (!canAccess) {
      throw new ForbiddenException('You cannot access this goal.');
    }

    const remark = await this.prisma.remark.create({
      data: {
        goalId,
        authorId: user.id,
        content: dto.content,
      },
      select: remarkSelect,
    });

    await this.notifyHigherRole(goal.officeId, goalId, remark.id, user, dto.content);
    await this.activityLogService.log(user.id, 'CREATE', 'Remark', remark.id, { goalId, content: dto.content });

    return remark;
  }

  async findAll(goalId: string, user: AuthenticatedUser, query: QueryRemarksDto) {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
      select: { id: true, officeId: true },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found.');
    }

    const canAccess = await this.officesService.canAccessOffice(user, goal.officeId);
    if (!canAccess) {
      throw new ForbiddenException('You cannot access this goal.');
    }

    const take = query.take ?? 20;
    const skip = query.skip ?? 0;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.remark.findMany({
        where: { goalId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: remarkSelect,
      }),
      this.prisma.remark.count({ where: { goalId } }),
    ]);

    return { data, meta: { total, take, skip, returned: data.length } };
  }

  async delete(goalId: string, remarkId: string, user: AuthenticatedUser) {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
      select: { id: true, officeId: true },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found.');
    }

    const canAccess = await this.officesService.canAccessOffice(user, goal.officeId);
    if (!canAccess) {
      throw new ForbiddenException('You cannot access this goal.');
    }

    const remark = await this.prisma.remark.findUnique({
      where: { id: remarkId },
      select: { id: true, authorId: true },
    });

    if (!remark) {
      throw new NotFoundException('Remark not found.');
    }

    if (remark.authorId !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException('You can only delete your own remarks.');
    }

    await this.prisma.remark.delete({ where: { id: remarkId } });
    await this.activityLogService.log(user.id, 'DELETE', 'Remark', remarkId, { goalId });
  }

  private async notifyHigherRole(
    officeId: string,
    goalId: string,
    remarkId: string,
    user: AuthenticatedUser,
    content: string,
  ) {
    const nextRole = ROLE_HIERARCHY[user.role];
    if (!nextRole) return;

    const office = await this.prisma.office.findUnique({
      where: { id: officeId },
      select: {
        name: true,
        parentId: true,
      },
    });

    if (!office) return;
    if (!office.parentId) return;

    const parentOffice = await this.prisma.office.findUnique({
      where: { id: office.parentId },
      select: { id: true },
    });

    if (!parentOffice) return;

    const recipients = await this.prisma.user.findMany({
      where: {
        officeId: parentOffice.id,
        role: nextRole as Role,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (recipients.length === 0) return;

    await this.prisma.notification.createMany({
      data: recipients.map((r) => ({
        userId: r.id,
        title: 'New remark on goal',
        message: `${user.name} commented on a goal in ${office.name}.`,
        type: 'INFO' as const,
        link: `/goals?goal=${goalId}&remark=${remarkId}`,
      })),
    });
  }
}
