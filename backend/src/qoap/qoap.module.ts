import { Module } from '@nestjs/common';
import { OfficesModule } from '../offices/offices.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { QoapController } from './qoap.controller';
import { QoapService } from './qoap.service';
import { QoapExportService } from './qoap-export.service';

@Module({
  imports: [OfficesModule, ActivityLogModule],
  controllers: [QoapController],
  providers: [QoapService, QoapExportService],
  exports: [QoapService, QoapExportService],
})
export class QoapModule {}
