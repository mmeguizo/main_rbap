import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { GoalStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryObjectivesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({ example: 20 })
  take: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({ example: 0 })
  skip: number = 0;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'cmnzr74pb0000i4v8sl99f7je',
    description: 'Filter objectives to one visible office.',
  })
  officeId?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'cmplan123456789',
    description: 'Filter objectives to one plan.',
  })
  planId?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'cmgoal123456789',
    description: 'Filter objectives to one goal.',
  })
  goalId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @ApiPropertyOptional({
    example: 2026,
    description: 'Filter objectives by planning year.',
  })
  planningYear?: number;

  @IsOptional()
  @IsEnum(GoalStatus)
  @ApiPropertyOptional({
    enum: GoalStatus,
    example: GoalStatus.IN_PROGRESS,
    description: 'Filter objectives by current status.',
  })
  status?: GoalStatus;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'budget',
    description: 'Search objectives by result level, target result, KPI, or responsible person.',
  })
  search?: string;
}
