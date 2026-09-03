import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { Prisma } from '@prisma/client';

const notificationSelect = {
  id: true,
  title: true,
  message: true,
  type: true,
  read: true,
  link: true,
  createdAt: true,
};

export type NotificationDto = {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
  read: boolean;
  link: string | null;
  createdAt: Date;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser, query: QueryNotificationsDto) {
    const take = query.take ?? 20;
    const skip = query.skip ?? 0;

    const where: Prisma.NotificationWhereInput = { userId: user.id };

    if (query.read !== undefined) {
      where.read = query.read;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { message: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: notificationSelect,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, total, take, skip };
  }

  async findOne(
    id: string,
    userId: string,
  ): Promise<NotificationDto> {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: notificationSelect,
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    return notification;
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, read: false },
    });
    return { count };
  }

  async markAsRead(
    userId: string,
    notificationId: string,
  ): Promise<NotificationDto> {
    try {
      const notification = await this.prisma.notification.update({
        where: { id: notificationId, userId },
        data: { read: true },
        select: notificationSelect,
      });
      this.logger.log(`Marked as read: notification ${notificationId} for user ${userId}`);
      return notification;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Notification not found');
      }
      throw e;
    }
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    this.logger.log(`Marked all as read: ${result.count} notifications for user ${userId}`);
    return { count: result.count };
  }
}
