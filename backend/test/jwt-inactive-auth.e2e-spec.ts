import { Controller, ForbiddenException, Get, INestApplication, UseGuards } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { JwtStrategy } from '../src/auth/strategies/jwt-auth.guard';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { UsersService } from '../src/users/users.service';

@Controller('test')
class TestController {
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe() {
    return { ok: true };
  }
}

describe('JwtAuthGuard inactive user (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            secret: config.getOrThrow('JWT_SECRET'),
            signOptions: { expiresIn: '15m' },
          }),
        }),
      ],
      controllers: [TestController],
      providers: [
        JwtStrategy,
        JwtAuthGuard,
        {
          provide: UsersService,
          useValue: {
            findById: jest
              .fn()
              .mockRejectedValue(new ForbiddenException('Account is inactive. Please contact admin.')),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    jwtService = app.get(JwtService);
  });

  it('rejects an inactive user JWT with 403', () => {
    const token = jwtService.sign({ sub: 'inactive-user-id', email: 'inactive@test.com', role: 'OFFICE_HEAD' });
    return request(app.getHttpServer())
      .get('/test/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  afterAll(async () => {
    await app.close();
  });
});
