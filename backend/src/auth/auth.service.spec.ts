import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('AuthService.refresh', () => {
  let service: AuthService;

  const jwtServiceMock = {
    verify: jest.fn(),
    sign: jest.fn(),
  };

  const usersServiceMock = {
    findById: jest.fn<(id: string) => Promise<any>>(),
    findByEmail: jest.fn<() => Promise<any>>(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: UsersService, useValue: usersServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('throws UnauthorizedException when refresh token is invalid', async () => {
    jwtServiceMock.verify.mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    await expect(service.refresh('bad-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns new tokens when refresh token is valid', async () => {
    jwtServiceMock.verify.mockReturnValue({
      sub: 'u1',
      type: 'refresh',
    });

    usersServiceMock.findById.mockResolvedValue({
      id: 'u1',
      email: 'mark.meguizo@chmsu.edu.ph',
      role: 'ADMIN',
    });

    jwtServiceMock.sign
      .mockReturnValueOnce('new-access-token')
      .mockReturnValueOnce('new-refresh-token');

    const result = await service.refresh('good-token');

    expect(result).toEqual({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
    });

    expect(usersServiceMock.findById).toHaveBeenCalledWith('u1');
    expect(jwtServiceMock.sign).toHaveBeenCalledTimes(2);
  });
});
