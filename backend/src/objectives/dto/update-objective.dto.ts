import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { GoalStatus } from '@prisma/client';
import { CreateObjectiveDto } from './create-objective.dto';

export class UpdateObjectiveDto extends PartialType(CreateObjectiveDto) {
  @IsOptional()
  @IsEnum(GoalStatus)
  @ApiPropertyOptional({ enum: GoalStatus, example: GoalStatus.IN_PROGRESS })
  status?: GoalStatus;
}
