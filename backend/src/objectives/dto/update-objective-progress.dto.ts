import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { GoalStatus } from '@prisma/client';

export class UpdateObjectiveProgressDto {
  @IsEnum(GoalStatus)
  @ApiProperty({ enum: GoalStatus, example: GoalStatus.IN_PROGRESS })
  status!: GoalStatus;
}
