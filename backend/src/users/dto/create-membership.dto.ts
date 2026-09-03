import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Role, Workspace } from '@prisma/client';

export class CreateMembershipDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty({ enum: Workspace })
  @IsEnum(Workspace)
  workspace!: Workspace;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role!: Role;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  officeId?: string | null;
}
