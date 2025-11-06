import { IsString, IsNotEmpty } from 'class-validator';

export class UploadScreenshotDto {
  @IsString()
  @IsNotEmpty()
  imageData: string;

  @IsString()
  @IsNotEmpty()
  timeEntryId: string;
}

