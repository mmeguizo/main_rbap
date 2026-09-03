import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOfficeDto {
  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Office name', required: true })
  name!: string;

  @Type(() => String)
  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'User ID', required: false })
  userId?: string;

  @Type(() => String)
  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'Parent Office ID', required: false })
  parentId?: string;
}
