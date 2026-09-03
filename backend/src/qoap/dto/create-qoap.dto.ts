import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateQoapDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'cmnzr74pb0000i4v8sl99f7je',
    description: 'The RBAP Goal this QOAP extends.',
  })
  goalId!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'Improve service delivery response time by 20%.',
    description: 'QM-specific functional objective.',
  })
  functionalObjective!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'Number of information systems developed',
    description: 'QOAP-specific indicator.',
  })
  indicators!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'Number of resolved tickets / total tickets x 100',
    description: 'Indicator formula used by the QM workflow.',
  })
  indicatorFormula!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'Human resources, ICT resources, budget',
    description: 'QOAP resources and requirements.',
  })
  resources!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    example: 'ISO 9001:2015 recertification by December 2026.',
    description: 'Intended outcomes for the QOAP.',
  })
  intendedOutcomes!: string;
}
