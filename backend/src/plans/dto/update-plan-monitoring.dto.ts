import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdatePlanMonitoringDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Quarterly' })
  frequency?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'Planning and Monitoring Office' })
  reportingOffice?: string;

  @IsOptional()
  @IsString()
  preparedBy?: string;

  @IsOptional()
  @IsString()
  reviewedBy?: string;

  @IsOptional()
  @IsString()
  approvedBy?: string;

  @IsOptional()
  @IsDateString()
  preparedAt?: string;

  @IsOptional()
  @IsDateString()
  reviewedAt?: string;

  @IsOptional()
  @IsDateString()
  approvedAt?: string;
}
