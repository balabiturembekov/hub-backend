import { Controller, Post, Get, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { ScreenshotsService } from './screenshots.service';
import { UploadScreenshotDto } from './dto/upload-screenshot.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('screenshots')
@UseGuards(JwtAuthGuard)
export class ScreenshotsController {
  constructor(
    private readonly screenshotsService: ScreenshotsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ScreenshotsController.name);
  }

  @Post()
  async upload(@Body() dto: UploadScreenshotDto, @GetUser() user: any) {
    this.logger.debug(
      {
        timeEntryId: dto.timeEntryId,
        imageDataLength: dto.imageData?.length || 0,
        userId: user.id,
        companyId: user.companyId,
      },
      'Upload request received',
    );

    try {
      const result = await this.screenshotsService.upload(dto, user.companyId, user.id);
      this.logger.info({ screenshotId: result.id }, 'Upload successful');
      return result;
    } catch (error: any) {
      this.logger.error(
        {
          error: error.message,
          stack: error.stack,
          timeEntryId: dto.timeEntryId,
          userId: user.id,
        },
        'Upload error',
      );
      throw error;
    }
  }

  @Get('time-entry/:timeEntryId')
  async findByTimeEntry(@Param('timeEntryId') timeEntryId: string, @GetUser() user: any) {
    return this.screenshotsService.findByTimeEntry(timeEntryId, user.companyId, user.id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @GetUser() user: any) {
    return this.screenshotsService.delete(id, user.companyId, user.id);
  }
}

