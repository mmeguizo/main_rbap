import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlanDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @ApiProperty({ example: 2026, description: 'Planning year for the RBAP.' })
  planningYear!: number;

  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'University-wide',
    description: 'Campus covered by the plan.',
  })
  campus!: string;

  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'General Administration and Support',
    description: 'Program, project, activity, or KRA.',
  })
  programProjectActivityKRA!: string;

  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'CHMSU Strategic Plan 2025-2029/Information System Strategic Plan',
    description: 'Strategic alignment or planning document reference.',
  })
  strategicAlignment!: string;

  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'Digital and Technology Transformation',
    description: 'Breakthrough goals for the office plan.',
  })
  breakthroughGoals!: string;

  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example:
      'To integrate smart, safe, and sustainable technologies in the university operations.',
    description: 'Strategic objectives of the annual plan.',
  })
  strategicObjectives!: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    example: '2026-01-26',
    description: 'Date the plan was prepared.',
  })
  datePrepared?: string;

  @Type(() => String)
  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    example: 'Quarterly',
    description: 'Monitoring frequency used for the plan.',
  })
  monitoringFrequency?: string;

  @Type(() => String)
  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    example: 'Information Technology Services Unit',
    description: 'Reporting office text shown in the RBAP sheet.',
  })
  reportingOffice?: string;

  @Type(() => String)
  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    example: 'cmspq7pe600007cv8s6s0xnsj',
    description: 'Target office ID for the plan.',
  })
  officeId?: string;

  @Type(() => String)
  @IsString()
  @IsOptional()
  @ApiPropertyOptional({
    example: 'Information Technology Services Unit',
    description: 'Target office name for the plan.',
  })
  officeName?: string;
}
