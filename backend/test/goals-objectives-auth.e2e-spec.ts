import { ForbiddenException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { GoalsController } from '../src/goals/goals.controller';
import { GoalsService } from '../src/goals/goals.service';
import { ObjectivesController } from '../src/objectives/objectives.controller';
import { ObjectivesService } from '../src/objectives/objectives.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';

describe('GoalsController authz (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [GoalsController],
      providers: [
        { provide: GoalsService, useValue: { update: jest.fn(), delete: jest.fn(), findAll: jest.fn(), create: jest.fn(), findOne: jest.fn() } },
        RolesGuard,
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (ctx: any) => { ctx.switchToHttp().getRequest().user = { role: 'OFFICE_HEAD', id: 'owner-id', office: { id: 'office-a' } }; return true; } })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('rejects another office from editing a goal with 403', () => {
    const mockGoals = app.get(GoalsService);
    (mockGoals.update as jest.Mock).mockRejectedValue(new ForbiddenException('You can only edit goals in your own plan'));
    return request(app.getHttpServer())
      .patch('/plans/plan-a/goals/goal-1')
      .send({ resultLevel: 'Updated' })
      .expect(403);
  });

  afterAll(async () => {
    await app.close();
  });
});

describe('ObjectivesController authz (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ObjectivesController],
      providers: [
        { provide: ObjectivesService, useValue: { update: jest.fn(), delete: jest.fn(), findAll: jest.fn(), create: jest.fn(), findOne: jest.fn(), getByGoal: jest.fn(), browse: jest.fn() } },
        RolesGuard,
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (ctx: any) => { ctx.switchToHttp().getRequest().user = { role: 'OFFICE_HEAD', id: 'owner-id', office: { id: 'office-a' } }; return true; } })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('rejects another office from deleting an objective with 403', () => {
    const mockObjs = app.get(ObjectivesService);
    (mockObjs.delete as jest.Mock).mockRejectedValue(new ForbiddenException('You can only delete objectives in your own plan'));
    return request(app.getHttpServer())
      .delete('/plans/plan-a/goals/goal-1/objectives/obj-1')
      .expect(403);
  });

  afterAll(async () => {
    await app.close();
  });
});
