import { Module } from '@nestjs/common';
import { OfficesModule } from '../offices/offices.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { GoalsBrowseController } from './goals-browse.controller';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

@Module({
  imports: [OfficesModule, ActivityLogModule],
  controllers: [GoalsController, GoalsBrowseController],
  providers: [GoalsService],
})
export class GoalsModule {}
