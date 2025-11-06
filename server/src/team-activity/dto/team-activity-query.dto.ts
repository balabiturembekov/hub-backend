import { IsOptional, IsEnum, IsDateString, IsString } from 'class-validator';

export enum ActivityPeriod {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_7_DAYS = '7days',
  LAST_30_DAYS = '30days',
  LAST_90_DAYS = '90days',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  THIS_YEAR = 'this_year',
  CUSTOM = 'custom',
}

export class TeamActivityQueryDto {
  @IsOptional()
  @IsEnum(ActivityPeriod)
  period?: ActivityPeriod;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;
}

