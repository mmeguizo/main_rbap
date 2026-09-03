import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

describe('UsersService', () => {
  let service: UsersService;

  // This is the FAKE Prisma — none of these hit a real DB
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    office: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock }, // ← inject the fake
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks(); // ← reset all fakes before each test
  });

  // ===========================
  // changeStatus
  // ===========================
  describe('changeStatus', () => {
    it('throws NotFoundException when user does not exist', async () => {
      // ARRANGE: fake Prisma returns null (user not found)
      prismaMock.user.findUnique.mockResolvedValue(null as never);

      // ACT + ASSERT: calling changeStatus should throw
      await expect(service.changeStatus('fake-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
