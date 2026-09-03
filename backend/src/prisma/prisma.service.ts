import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL');

    if (!connectionString) {
      throw new Error('DATABASE_URL is missing in environment variables.');
    }

    const adapter = new PrismaPg({ connectionString });
    super({ adapter, log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'] });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
