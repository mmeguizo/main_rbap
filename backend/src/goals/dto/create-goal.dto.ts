import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGoalDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'A' })
  code?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({ example: 0 })
  displayOrder?: number;

  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'Outcome A' })
  resultLevel!: string;

  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example:
      'Enhanced ICT infrastructure that supports efficient service and quality teaching-learning activities',
  })
  targetResult!: string;

  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'Implement ICT infrastructure projects aligned to ISSP.',
  })
  keyActions!: string;

  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example:
      'Limited budget to allocate for procuring ICT infrastructure projects',
  })
  keyRisk!: string;

  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'Seek external funding from other government agencies',
  })
  mitigationMeasures!: string;

  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'Number of ICT infrastructure projects implemented',
  })
  keyPerformanceIndicator!: string;

  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '10 ICT infrastructure projects' })
  target!: string;

  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'ICT-ITS, ICT-MIS' })
  responsibleOfficePerson!: string;

  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '4th qtr 2026' })
  timeline!: string;

  @Type(() => String)
  @IsString()
  @IsOptional()
  @ApiPropertyOptional({ example: 'GAA/Income' })
  fundSource?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @ApiPropertyOptional({ example: 4266000 })
  budgetRequirements?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @ApiPropertyOptional({ example: 971200 })
  budgetAllocation?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @ApiPropertyOptional({ example: 100000 })
  budgetDeficit?: number;

  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'Purchase Request/ Purchase Order/ Completion Report',
  })
  meansOfVerification!: string;
}
