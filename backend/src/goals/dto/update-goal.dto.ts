import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { GoalStatus } from '@prisma/client';
import { CreateGoalDto } from './create-goal.dto';

export class UpdateGoalDto extends PartialType(CreateGoalDto) {
  @IsOptional()
  @IsEnum(GoalStatus)
  @ApiPropertyOptional({ enum: GoalStatus, example: GoalStatus.IN_PROGRESS })
  status?: GoalStatus;
}
