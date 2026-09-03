import { ForbiddenException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { afterAll, beforeAll, describe, it, jest } from '@jest/globals';
import request from 'supertest';
import { PlansController } from '../src/plans/plans.controller';
import { PlansService } from '../src/plans/plans.service';
import { PdfExportService } from '../src/plans/pdf-export.service';
import { ExcelExportService } from '../src/plans/excel-export.service';
import { ExcelImportService } from '../src/plans/excel-import.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';

const mockPlanService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  submit: jest.fn(),
  approve: jest.fn(),
  getSummary: jest.fn(),
  findPendingApprovals: jest.fn(),
};

describe('PlansController authz (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PlansController],
      providers: [
        { provide: PlansService, useValue: mockPlanService },
        { provide: PdfExportService, useValue: { exportPdf: jest.fn() } },
        { provide: ExcelExportService, useValue: { exportExcel: jest.fn() } },
        { provide: ExcelImportService, useValue: { importExcel: jest.fn() } },
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects editing a different office draft plan with 403', () => {
    mockPlanService.update.mockRejectedValue(new ForbiddenException('You can only edit your own office'));
    return request(app.getHttpServer())
      .patch('/plans/some-plan-id')
      .send({ campus: 'New Campus' })
      .expect(403);
  });

  it('allows the owning office to edit a submitted plan', () => {
    mockPlanService.update.mockResolvedValue({
      id: 'plan-id',
      status: 'SUBMITTED',
    });
    return request(app.getHttpServer())
      .patch('/plans/some-plan-id')
      .send({ campus: 'New Campus' })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});

describe('PlansController supervisor approval (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PlansController],
      providers: [
        { provide: PlansService, useValue: mockPlanService },
        { provide: PdfExportService, useValue: { exportPdf: jest.fn() } },
        { provide: ExcelExportService, useValue: { exportExcel: jest.fn() } },
        { provide: ExcelImportService, useValue: { importExcel: jest.fn() } },
        RolesGuard,
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (ctx: any) => { ctx.switchToHttp().getRequest().user = { role: 'DIRECTORS', id: 'supervisor-id', office: { id: 'office-b' } }; return true; } })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('allows supervisor to approve a plan with 200', () => {
    mockPlanService.approve.mockResolvedValue({ id: 'plan-id', status: 'APPROVED' });
    return request(app.getHttpServer())
      .patch('/plans/some-plan-id/approve')
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
