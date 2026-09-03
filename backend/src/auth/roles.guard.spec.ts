import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  const mockContext = (user?: { role: string }) => {
    const req = user ? { user } : {};
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => 'handler',
      getClass: () => 'class',
    } as unknown as jest.Mocked<ExecutionContext>;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn<(args: any) => any>(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get(Reflector);
  });

  it('allows access when no roles are required', () => {
    (reflector.getAllAndOverride as any).mockReturnValue(undefined);

    const result = guard.canActivate(mockContext({ role: 'OFFICE_HEAD' }));

    expect(result).toBe(true);
  });

  it('allows access when required roles array is empty', () => {
    (reflector.getAllAndOverride as any).mockReturnValue([]);

    const result = guard.canActivate(mockContext({ role: 'OFFICE_HEAD' }));

    expect(result).toBe(true);
  });

  it('allows access when user role is in required roles', () => {
    (reflector.getAllAndOverride as any).mockReturnValue(['ADMIN', 'PRESIDENTS']);

    const result = guard.canActivate(mockContext({ role: 'ADMIN' }));

    expect(result).toBe(true);
  });

  it('denies access when user role is not in required roles', () => {
    (reflector.getAllAndOverride as any).mockReturnValue(['ADMIN']);

    expect(() => guard.canActivate(mockContext({ role: 'OFFICE_HEAD' }))).toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException when user is missing', () => {
    (reflector.getAllAndOverride as any).mockReturnValue(['ADMIN']);

    expect(() => guard.canActivate(mockContext())).toThrow(ForbiddenException);
  });

  it('allows ADMIN access to ADMIN-only endpoints', () => {
    (reflector.getAllAndOverride as any).mockReturnValue(['ADMIN']);

    const result = guard.canActivate(mockContext({ role: 'ADMIN' }));

    expect(result).toBe(true);
  });

  it('allows OFFICE_HEAD access when OFFICE_HEAD is in required roles', () => {
    (reflector.getAllAndOverride as any).mockReturnValue([
      'ADMIN',
      'PRESIDENTS',
      'VICE_PRESIDENTS',
      'DIRECTORS',
      'OFFICE_HEAD',
    ]);

    const result = guard.canActivate(mockContext({ role: 'OFFICE_HEAD' }));

    expect(result).toBe(true);
  });
});
