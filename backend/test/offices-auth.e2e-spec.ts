import {
  BadRequestException,
  INestApplication,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { OfficesController } from '../src/offices/offices.controller';
import { OfficesService } from '../src/offices/offices.service';
import { ActivityLogService } from '../src/activity-log/activity-log.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';

describe('OfficesController authz (e2e)', () => {
  let app: INestApplication;
  let officesService: jest.Mocked<OfficesService>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [OfficesController],
      providers: [
        { provide: OfficesService, useValue: { getAll: jest.fn(), addOffice: jest.fn(), updateOffice: jest.fn(), deleteOffice: jest.fn(), findById: jest.fn() } },
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
    officesService = app.get(OfficesService);
  });

  it('rejects OFFICE_HEAD from creating an office with 403', () => {
    return request(app.getHttpServer())
      .post('/offices/add-office')
      .send({ name: 'New Office' })
      .expect(403);
  });

  it('rejects OFFICE_HEAD from updating an office with 403', () => {
    return request(app.getHttpServer())
      .patch('/offices/update-office')
      .send({ officeId: 'any-id', name: 'Renamed' })
      .expect(403);
  });

  afterAll(async () => {
    await app.close();
  });
});

describe('OfficesController cycle rejection (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [OfficesController],
      providers: [
        {
          provide: OfficesService,
          useValue: {
            updateOffice: jest.fn().mockRejectedValue(new BadRequestException('Cycle detected')),
          },
        },
        { provide: ActivityLogService, useValue: { log: jest.fn() } },
        RolesGuard,
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (ctx: any) => { ctx.switchToHttp().getRequest().user = { role: 'ADMIN', id: 'admin-id' }; return true; } })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('returns 400 on descendant-cycle when updating office parentId', () => {
    return request(app.getHttpServer())
      .patch('/offices/update-office')
      .send({ officeId: 'office-a', parentId: 'office-b' })
      .expect(400);
  });

  afterAll(async () => {
    await app.close();
  });
});
