import { Module } from '@nestjs/common';
import { OfficesModule } from '../offices/offices.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { ObjectivesBrowseController } from './objectives-browse.controller';
import { ObjectivesController } from './objectives.controller';
import { ObjectivesService } from './objectives.service';

@Module({
  imports: [OfficesModule, ActivityLogModule],
  controllers: [ObjectivesController, ObjectivesBrowseController],
  providers: [ObjectivesService],
})
export class ObjectivesModule {}
