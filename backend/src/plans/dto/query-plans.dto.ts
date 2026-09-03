import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PlanStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryPlansDto {
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
    description: 'Filter plans to one visible office.',
  })
  officeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @ApiPropertyOptional({
    example: 2026,
    description: 'Filter plans by planning year.',
  })
  planningYear?: number;

  @IsOptional()
  @IsEnum(PlanStatus)
  @ApiPropertyOptional({
    enum: PlanStatus,
    example: PlanStatus.SUBMITTED,
    description: 'Filter plans by plan status.',
  })
  status?: PlanStatus;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'research',
    description: 'Search plans by program/activity/KRA or campus.',
  })
  search?: string;
}
