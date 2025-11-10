import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UploadScreenshotDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50 * 1024 * 1024, {
    message: 'Image data exceeds maximum size (50MB)',
  })
  imageData: string;

  @IsString()
  @IsNotEmpty()
  timeEntryId: string;
}

