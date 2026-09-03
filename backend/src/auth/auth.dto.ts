import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Workspace } from '@prisma/client';

export class DevLoginDto {
  @ApiProperty({ example: 'mark.meguizo@chmsu.edu.ph' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: Workspace, required: false, default: Workspace.RBAP })
  @IsOptional()
  @IsEnum(Workspace)
  workspace?: Workspace;
}

export class PasswordLoginDto {
  @ApiProperty({ example: 'mark.meguizo@chmsu.edu.ph' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPassword123' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: Workspace, required: false, default: Workspace.RBAP })
  @IsOptional()
  @IsEnum(Workspace)
  workspace?: Workspace;
}

export class SetPasswordDto {
  @ApiProperty({ example: 'StrongPassword123' })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class WorkspaceSelectionDto {
  @ApiProperty({ enum: Workspace })
  @IsEnum(Workspace)
  workspace!: Workspace;
}

export class RegisterDto {
  @ApiProperty({ example: 'mark.meguizo@chmsu.edu.ph' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Mark Meguizo' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'StrongPassword123' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description:
      'Short-lived token issued only after a successful Google OAuth callback for first-time account registration.',
  })
  @IsString()
  @MinLength(1)
  googleRegistrationToken!: string;
}
