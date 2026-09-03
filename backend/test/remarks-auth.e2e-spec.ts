import { ForbiddenException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { RemarksController } from '../src/remarks/remarks.controller';
import { RemarksService } from '../src/remarks/remarks.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';

describe('RemarksController authz (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [RemarksController],
      providers: [
        { provide: RemarksService, useValue: { findAll: jest.fn(), delete: jest.fn(), create: jest.fn() } },
        RolesGuard,
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (ctx: any) => { ctx.switchToHttp().getRequest().user = { role: 'OFFICE_HEAD', id: 'non-author-id', office: { id: 'office-b' } }; return true; } })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('rejects a non-author from deleting a remark with 403', () => {
    const remarksService = app.get(RemarksService);
    (remarksService.delete as jest.Mock).mockRejectedValue(new ForbiddenException('You can only delete your own remarks'));
    return request(app.getHttpServer())
      .delete('/goals/goal-1/remarks/remark-1')
      .expect(403);
  });

  it('rejects an unrelated office from reading a goal remarks with 403', () => {
    const remarksService = app.get(RemarksService);
    (remarksService.findAll as jest.Mock).mockRejectedValue(new ForbiddenException('Not authorized to view remarks for this goal'));
    return request(app.getHttpServer())
      .get('/goals/goal-1/remarks')
      .expect(403);
  });

  afterAll(async () => {
    await app.close();
  });
});
