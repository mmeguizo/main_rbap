import { IsString } from 'class-validator';

export class AccountContextDto {
  @IsString()
  id!: string;

  @IsString()
  workspace!: string;

  @IsString()
  role!: string;

  @IsString()
  status!: string;

  office!: {
    id: string;
    name: string;
  } | null;
}

export class getDto {
  @IsString()
  id!: string;

  @IsString()
  email!: string;

  // The user's display name — populated from the Google profile on first login
  @IsString()
  name!: string;

  @IsString()
  role!: string;

  @IsString()
  workspace!: string;

  @IsString()
  accountId!: string;

  account!: AccountContextDto;
}
