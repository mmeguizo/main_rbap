import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { OfficesModule } from './offices/offices.module';
import { PlansModule } from './plans/plans.module';
import { GoalsModule } from './goals/goals.module';
import { ObjectivesModule } from './objectives/objectives.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { RemarksModule } from './remarks/remarks.module';
import { MetricsModule } from './metrics/metrics.module';
import { QoapModule } from './qoap/qoap.module';
import { QomModule } from './qom/qom.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    OfficesModule,
    PlansModule,
    GoalsModule,
    ObjectivesModule,
    NotificationsModule,
    ActivityLogModule,
    RemarksModule,
    MetricsModule,
    QoapModule,
    QomModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
