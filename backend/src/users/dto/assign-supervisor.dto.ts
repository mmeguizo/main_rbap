import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignSupervisorDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsString()
  supervisorId?: string | null;
}
