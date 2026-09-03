import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateOfficeDto {
  @Type(() => String)
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: 'Office ID', required: true })
  officeId!: string;

  @Type(() => String)
  @IsString()
  @IsOptional()
  @ApiProperty({ description: 'Office name', required: false })
  name?: string;

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
