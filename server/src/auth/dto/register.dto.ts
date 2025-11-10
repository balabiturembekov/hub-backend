import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsNumber, Min, Max, IsUrl } from 'class-validator';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsEmail()
  @MaxLength(255, { message: 'Email must not exceed 255 characters' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  companyName: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Company domain must not exceed 255 characters' })
  companyDomain?: string;

  @IsOptional()
  role?: UserRole;

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }, { message: 'Avatar must be a valid HTTP/HTTPS URL' })
  @MaxLength(2048, { message: 'Avatar URL must not exceed 2048 characters' })
  avatar?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  hourlyRate?: number;
}

