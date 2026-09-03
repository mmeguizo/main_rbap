import { Test, TestingModule } from '@nestjs/testing';
import { describe, beforeEach, it, expect } from '@jest/globals';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;

  const mockPrisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ '1': 1 }]),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('healthz', () => {
    it('should return ok when database is reachable', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);
      const result = await appController.healthz();
      expect(result).toMatchObject({ status: 'ok', database: 'connected' });
      expect(result).toHaveProperty('timestamp');
    });

    it('should throw 503 when database is unreachable', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));
      await expect(appController.healthz()).rejects.toThrow();
    });
  });
});
