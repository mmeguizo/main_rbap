import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PlanStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryExcelExportDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Filter plans to one visible office.' })
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
    description: 'Filter plans by status.',
  })
  status?: PlanStatus;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Search in KRA or strategic alignment.' })
  search?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Comma-separated list of plan IDs to export.' })
  planIds?: string;
}
