import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryQoapDto {
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
    description: 'Filter QOAPs to one visible office.',
  })
  officeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @ApiPropertyOptional({
    example: 2026,
    description: 'Filter QOAPs by the parent plan planning year.',
  })
  planningYear?: number;
}
