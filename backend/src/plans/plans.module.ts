import { Module } from '@nestjs/common';
import { OfficesModule } from '../offices/offices.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { PdfExportService } from './pdf-export.service';
import { ExcelExportService } from './excel-export.service';
import { ExcelImportService } from './excel-import.service';

@Module({
  imports: [OfficesModule, NotificationsModule, ActivityLogModule],
  controllers: [PlansController],
  providers: [
    PlansService,
    PdfExportService,
    ExcelExportService,
    ExcelImportService,
  ],
  exports: [
    PlansService,
    PdfExportService,
    ExcelExportService,
    ExcelImportService,
  ],
})
export class PlansModule {}
