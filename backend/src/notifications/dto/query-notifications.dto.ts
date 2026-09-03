import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { NotificationType } from '@prisma/client';

export class QueryNotificationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({
    example: 20,
    description: 'Number of notifications to return',
  })
  take: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({
    example: 0,
    description: 'Number of notifications to skip',
  })
  skip: number = 0;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  @ApiPropertyOptional({
    example: false,
    description: 'Filter by read status (true=for read, false=for unread)',
  })
  read?: boolean;

  @IsOptional()
  @IsString()
  @IsEnum(NotificationType)
  @ApiPropertyOptional({
    enum: NotificationType,
    example: 'WARNING',
    description: 'Filter by notification type',
  })
  type?: NotificationType;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'Earliest notification date (ISO)',
  })
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    example: '2026-07-14',
    description: 'Latest notification date (ISO)',
  })
  dateTo?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'plan',
    description: 'Search in title and message (case-insensitive)',
  })
  search?: string;
}
