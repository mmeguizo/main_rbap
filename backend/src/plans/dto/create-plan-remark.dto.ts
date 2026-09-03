import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreatePlanRemarkDto {
  @ApiProperty({
    description: 'Feedback to return with the plan',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'content must contain non-whitespace characters' })
  @MaxLength(2000)
  content: string;
}
