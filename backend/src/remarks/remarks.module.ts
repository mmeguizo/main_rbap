import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OfficesModule } from '../offices/offices.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { RemarksController } from './remarks.controller';
import { RemarksService } from './remarks.service';

@Module({
  imports: [PrismaModule, OfficesModule, NotificationsModule, ActivityLogModule],
  controllers: [RemarksController],
  providers: [RemarksService],
})
export class RemarksModule {}
