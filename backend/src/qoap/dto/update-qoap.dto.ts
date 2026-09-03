import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateQoapDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({
    example: 'Improve service delivery response time by 25%.',
    description: 'QM-specific functional objective.',
  })
  functionalObjective?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({
    example: 'Number of information systems developed',
    description: 'QOAP-specific indicator.',
  })
  indicators?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({
    example: 'Number of resolved tickets / total tickets x 100',
    description: 'Indicator formula used by the QM workflow.',
  })
  indicatorFormula?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({
    example: 'Human resources, ICT resources, budget',
    description: 'QOAP resources and requirements.',
  })
  resources?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional({
    example: 'ISO 9001:2015 recertification by December 2026.',
    description: 'Intended outcomes for the QOAP.',
  })
  intendedOutcomes?: string;
}
