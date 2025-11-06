import { IsString, IsOptional, IsEnum, IsDateString, MaxLength } from 'class-validator';
import { EntryStatus } from '@prisma/client';

export class CreateTimeEntryDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsEnum(EntryStatus)
  status?: EntryStatus;
}

