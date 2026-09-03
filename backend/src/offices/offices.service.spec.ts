import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { OfficesService } from './offices.service';
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

const prismaMock = {
  office: {
    findMany: jest.fn<(args: any) => Promise<any>>(),
    findUnique: jest.fn<(args: any) => Promise<any>>(),
    findFirst: jest.fn<(args: any) => Promise<any>>(),
    count: jest.fn<(args: any) => Promise<any>>(),
    create: jest.fn<(args: any) => Promise<any>>(),
    update: jest.fn<(args: any) => Promise<any>>(),
  },
  user: {
    findUnique: jest.fn<(args: any) => Promise<any>>(),
    update: jest.fn<(args: any) => Promise<any>>(),
  },
  $transaction: jest.fn<(args: any) => Promise<any>>(),
};

describe('OfficesService', () => {
  let service: OfficesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OfficesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<OfficesService>(OfficesService);
  });

  describe('findAll', () => {
    it('returns paginated offices', async () => {
      const mockOffices = [{ id: 'off-1', name: 'Office A' }];
      (prismaMock.office.findMany as any).mockResolvedValue(mockOffices);

      const result = await service.findAll(20, 0);

      expect(result).toEqual(mockOffices);
      expect(prismaMock.office.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 0 }),
      );
    });
  });

  describe('findAllPaginated', () => {
    it('returns paginated offices with meta', async () => {
      const mockOffices = [{ id: 'off-1', name: 'Office A', members: [], head: null }];
      (prismaMock.$transaction as any).mockResolvedValue([mockOffices, 1]);

      const result = await service.findAllPaginated(20, 0);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.take).toBe(20);
      expect(result.meta.skip).toBe(0);
      expect(result.meta.returned).toBe(1);
    });
  });

  describe('getAccessibleOfficeIds', () => {
    it('returns all active offices for ADMIN', async () => {
      const adminUser = { ...mockUser, role: 'ADMIN' };
      (prismaMock.office.findMany as any).mockResolvedValue([
        { id: 'off-1' },
        { id: 'off-2' },
      ]);

      const result = await service.getAccessibleOfficeIds(adminUser);

      expect(result).toEqual(['off-1', 'off-2']);
    });

    it('returns own office only for OFFICE_HEAD', async () => {
      const result = await service.getAccessibleOfficeIds(mockUser);

      expect(result).toEqual(['off-1']);
    });

    it('returns own plus child offices for DIRECTORS', async () => {
      const directorUser = { ...mockUser, role: 'DIRECTORS' };
      (prismaMock.office.findMany as any).mockResolvedValue([
        { id: 'child-1' },
      ]);

      const result = await service.getAccessibleOfficeIds(directorUser);

      expect(result).toEqual(['off-1', 'child-1']);
    });

    it('returns empty array when user has no office', async () => {
      const userNoOffice = { ...mockUser, office: undefined };
      (prismaMock.office.findMany as any).mockResolvedValue([]);

      const result = await service.getAccessibleOfficeIds(userNoOffice);

      expect(result).toEqual([]);
    });
  });

  describe('canAccessOffice', () => {
    it('returns true when office is accessible', async () => {
      (prismaMock.office.findMany as any).mockResolvedValue([]);

      const result = await service.canAccessOffice(mockUser, 'off-1');

      expect(result).toBe(true);
    });

    it('returns false when office is not accessible', async () => {
      (prismaMock.office.findMany as any).mockResolvedValue([]);

      const result = await service.canAccessOffice(mockUser, 'off-999');

      expect(result).toBe(false);
    });
  });

  describe('addOffice', () => {
    it('throws BadRequestException when name is missing', async () => {
      await expect(service.addOffice('')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when parent not found', async () => {
      (prismaMock.office.findUnique as any).mockResolvedValue(null);

      await expect(
        service.addOffice('New Office', undefined, 'parent-999'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when user cannot access parent', async () => {
      (prismaMock.office.findUnique as any).mockResolvedValue({ id: 'parent-1' });
      // OFFICE_HEAD can't access other offices
      (prismaMock.office.findMany as any).mockResolvedValue([]);

      await expect(
        service.addOffice('New Office', undefined, 'parent-1', mockUser),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('creates an office with transaction', async () => {
      const newOffice = { id: 'new-off', name: 'New Office', headId: null, parentId: null };
      (prismaMock.office.findUnique as any).mockResolvedValue(null);
      (prismaMock.$transaction as any).mockImplementation(async (cb: Function) => {
        const tx = {
          office: {
            create: jest.fn<(args: any) => Promise<any>>().mockResolvedValue(newOffice),
            findUnique: jest.fn<(args: any) => Promise<any>>().mockResolvedValue(null),
          },
          user: {
            update: jest.fn<(args: any) => Promise<any>>().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      const result = await service.addOffice('New Office');

      expect(result).toEqual(newOffice);
    });
  });

  describe('updateOffice', () => {
    it('throws BadRequestException when officeId is missing', async () => {
      await expect(service.updateOffice('')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when office does not exist', async () => {
      (prismaMock.office.findUnique as any).mockResolvedValue(null);

      await expect(
        service.updateOffice('off-999'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when setting self as parent', async () => {
      (prismaMock.office.findUnique as any).mockResolvedValue({ headId: null, name: 'PMU' });

      await expect(
        service.updateOffice('off-1', undefined, undefined, 'off-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when setting descendant as parent', async () => {
      (prismaMock.office.findUnique as any).mockResolvedValue({ headId: null, name: 'PMU' });
      (prismaMock.office.findMany as any).mockResolvedValue([
        { id: 'off-1', parentId: null },
        { id: 'off-2', parentId: 'off-1' },
        { id: 'off-3', parentId: 'off-2' },
      ]);

      await expect(
        service.updateOffice('off-1', undefined, undefined, 'off-3'),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates office name', async () => {
      const updatedOffice = { id: 'off-1', name: 'Updated Name' };
      (prismaMock.office.findUnique as any).mockResolvedValue({ headId: null, name: 'Old' });
      (prismaMock.$transaction as any).mockImplementation(async (cb: Function) => {
        const tx = {
          office: {
            update: jest.fn<(args: any) => Promise<any>>().mockResolvedValue(updatedOffice),
            findUnique: jest.fn<(args: any) => Promise<any>>().mockResolvedValue(null),
          },
          user: {
            update: jest.fn<(args: any) => Promise<any>>().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      const result = await service.updateOffice('off-1', 'Updated Name');

      expect(result).toEqual(updatedOffice);
    });
  });

  describe('deleteAnOffice', () => {
    it('throws BadRequestException when officeId is missing', async () => {
      await expect(service.deleteAnOffice('')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when office does not exist', async () => {
      (prismaMock.$transaction as any).mockImplementation(async (cb: Function) => {
        const tx = {
          office: {
            findUnique: jest.fn<(args: any) => Promise<any>>().mockResolvedValue(null),
            update: jest.fn<(args: any) => Promise<any>>(),
          },
          user: {
            update: jest.fn<(args: any) => Promise<any>>(),
          },
        };
        return cb(tx);
      });

      await expect(service.deleteAnOffice('off-999')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('soft-deletes an office', async () => {
      (prismaMock.$transaction as any).mockImplementation(async (cb: Function) => {
        const tx = {
          office: {
            findUnique: jest.fn<(args: any) => Promise<any>>().mockResolvedValue({ headId: null }),
            update: jest.fn<(args: any) => Promise<any>>().mockResolvedValue({ id: 'off-1', status: 'INACTIVE' }),
          },
          user: {
            update: jest.fn<(args: any) => Promise<any>>().mockResolvedValue({}),
          },
        };
        return cb(tx);
      });

      const result = await service.deleteAnOffice('off-1');

      expect(result.status).toBe('INACTIVE');
    });
  });
});
