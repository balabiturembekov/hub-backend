import { IsOptional, IsString, IsDateString, IsInt, Min, Max, IsEnum, MaxLength } from 'class-validator';
import { EntryStatus } from '@prisma/client';

export class UpdateTimeEntryDto {
  @IsOptional()
  @IsString()
  projectId?: string | null;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  duration?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(EntryStatus)
  status?: EntryStatus;
}

