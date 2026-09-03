import { Module, forwardRef } from '@nestjs/common';
import { OfficesController } from './offices.controller';
import { OfficesService } from './offices.service';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [forwardRef(() => ActivityLogModule)],
  exports: [OfficesService],
  controllers: [OfficesController],
  providers: [OfficesService],
})
export class OfficesModule {}
