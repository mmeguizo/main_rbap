import { Module, forwardRef } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [forwardRef(() => ActivityLogModule)],
  providers: [UsersService],
  exports: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
