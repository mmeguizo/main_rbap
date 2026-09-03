import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
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

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: {
            notification: {
              findMany: jest
                .fn<(args: any) => Promise<any>>()
                .mockResolvedValue([]),
              count: jest
                .fn<(args: any) => Promise<any>>()
                .mockResolvedValue(0),
              update: jest.fn<(args: any) => Promise<any>>().mockResolvedValue({
                id: 'notif-1',
                title: 'Test',
                message: 'Message',
                type: 'INFO',
                read: true,
                link: null,
                createdAt: new Date(),
              }),
              updateMany: jest
                .fn<(args: any) => Promise<any>>()
                .mockResolvedValue({ count: 1 }),
            },
            $transaction: jest
              .fn<(args: any) => Promise<any>>()
              .mockResolvedValue([[], 0]),
          } as unknown as jest.Mocked<PrismaService>,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prisma = module.get(PrismaService);
  });

  describe('findAll', () => {
    it('returns paginated notifications for user', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          title: 'Test Title',
          message: 'Test Message',
          type: 'WARNING',
          read: false,
          link: '/plans/123',
          createdAt: new Date('2026-07-01'),
        },
      ];
      (prisma.notification.findMany as any).mockResolvedValue(
        mockNotifications,
      );
      (prisma.$transaction as any).mockResolvedValue([mockNotifications, 1]);

      const result = await service.findAll(mockUser, { take: 20, skip: 0 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.take).toBe(20);
      expect(result.skip).toBe(0);
    });

    it('filters by read status when provided', async () => {
      (prisma.$transaction as any).mockResolvedValue([[], 0]);

      await service.findAll(mockUser, { take: 20, skip: 0, read: true });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1', read: true },
        }),
      );
    });
  });

  describe('getUnreadCount', () => {
    it('returns count of unread notifications', async () => {
      (prisma.notification.count as any).mockResolvedValue(5);

      const result = await service.getUnreadCount('user-1');

      expect(result.count).toBe(5);
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
      });
    });
  });

  describe('markAsRead', () => {
    it('marks a notification as read', async () => {
      const result = await service.markAsRead('user-1', 'notif-1');

      expect(result.read).toBe(true);
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-1' },
        data: { read: true },
        select: expect.any(Object),
      });
    });
  });

  describe('markAllAsRead', () => {
    it('marks all notifications as read for user', async () => {
      (prisma.notification.updateMany as any).mockResolvedValue({ count: 3 });

      const result = await service.markAllAsRead('user-1');

      expect(result.count).toBe(3);
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', read: false },
        data: { read: true },
      });
    });
  });
});
