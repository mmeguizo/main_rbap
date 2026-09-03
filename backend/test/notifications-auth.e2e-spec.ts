import { ForbiddenException, INestApplication, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { NotificationsController } from '../src/notifications/notifications.controller';
import { NotificationsService } from '../src/notifications/notifications.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';

describe('NotificationsController authz (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: { getUnreadCount: jest.fn(), findOne: jest.fn(), markAsRead: jest.fn(), findAll: jest.fn(), markAllAsRead: jest.fn() } },
        RolesGuard,
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (ctx: any) => { ctx.switchToHttp().getRequest().user = { role: 'OFFICE_HEAD', id: 'user-a', office: { id: 'office-a' } }; return true; } })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('returns count from GET /notifications/unread-count', () => {
    const svc = app.get(NotificationsService);
    (svc.getUnreadCount as jest.Mock).mockResolvedValue({ count: 3 });
    return request(app.getHttpServer())
      .get('/notifications/unread-count')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('count');
        expect(res.body.count).toBe(3);
      });
  });

  it('rejects reading another user notification with 404', () => {
    const svc = app.get(NotificationsService);
    (svc.findOne as jest.Mock).mockRejectedValue(new NotFoundException());
    return request(app.getHttpServer())
      .get('/notifications/other-user-notif-id')
      .expect(404);
  });

  it('rejects marking another user notification read with 404', () => {
    const svc = app.get(NotificationsService);
    (svc.markAsRead as jest.Mock).mockRejectedValue(new NotFoundException());
    return request(app.getHttpServer())
      .patch('/notifications/other-user-notif-id/read')
      .expect(404);
  });

  afterAll(async () => {
    await app.close();
  });
});
