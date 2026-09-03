import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { ActivityLogService } from '../src/activity-log/activity-log.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';

describe('UsersController authz (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: { checkUserById: jest.fn(), changeUserRole: jest.fn(), assignToOffice: jest.fn(), changeStatus: jest.fn(), softDelete: jest.fn() } },
        { provide: ActivityLogService, useValue: { log: jest.fn() } },
        RolesGuard,
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (ctx: any) => { ctx.switchToHttp().getRequest().user = { role: 'OFFICE_HEAD', id: 'non-admin-id' }; return true; } })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('rejects non-admin from assigning a role with 403', () => {
    return request(app.getHttpServer())
      .post('/user/assign-role')
      .send({ userId: 'any-id', role: 'DIRECTORS' })
      .expect(403);
  });

  it('rejects non-admin from assigning an office with 403', () => {
    return request(app.getHttpServer())
      .post('/user/assign-office')
      .send({ userId: 'any-id', officeId: 'some-office-id' })
      .expect(403);
  });

  it('rejects non-admin from deactivating a user with 403', () => {
    return request(app.getHttpServer())
      .post('/user/change-user-status')
      .send({ userId: 'any-id' })
      .expect(403);
  });

  afterAll(async () => {
    await app.close();
  });
});
