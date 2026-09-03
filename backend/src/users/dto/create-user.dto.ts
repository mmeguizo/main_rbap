import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { Role, Workspace } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role = Role.OFFICE_HEAD;

  @IsOptional()
  @IsEnum(Workspace)
  workspace?: Workspace = Workspace.RBAP;

  @IsOptional()
  @IsString()
  officeId?: string;

  @IsOptional()
  @IsString()
  supervisorId?: string;
}
