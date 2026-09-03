import { Module } from '@nestjs/common';
import { OfficesModule } from '../offices/offices.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { QomController } from './qom.controller';
import { QomService } from './qom.service';

@Module({
  imports: [OfficesModule, ActivityLogModule],
  controllers: [QomController],
  providers: [QomService],
  exports: [QomService],
})
export class QomModule {}
