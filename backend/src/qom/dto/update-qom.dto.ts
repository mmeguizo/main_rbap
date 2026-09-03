import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Prisma } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateQomDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({
    example: 2,
    description: 'Monitoring number, unique within the QOAP.',
  })
  monitoringNo?: number;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    example: '2026-03-31',
    description: 'Most recent monitoring date (recency date).',
  })
  recencyDate?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    example: '2026-01-31',
    description: 'Previous monitoring date, when available.',
  })
  previousMonitoringDate?: string;

  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({
    example: { jan: '-', feb: '1', mar: '2' },
    description: 'Jan-Dec performance values keyed by month.',
  })
  performance?: Prisma.InputJsonValue;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({
    example: '2/3 milestones achieved.',
    description: 'Overall data result for this monitoring record.',
  })
  overallDataResult?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({
    example: 'QMS quarterly report, office submission.',
    description: 'Means of verification / data source.',
  })
  movDataSource?: string;
}
