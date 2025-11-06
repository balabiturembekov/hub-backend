import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { TimeEntriesService } from './time-entries.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('time-entries')
@UseGuards(JwtAuthGuard)
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Post()
  create(@Body() createTimeEntryDto: CreateTimeEntryDto, @GetUser() user: any) {
    if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      if (createTimeEntryDto.userId !== user.id) {
        throw new ForbiddenException('You can only create time entries for yourself');
      }
    }
    return this.timeEntriesService.create(createTimeEntryDto, user.companyId, user.id, user.role);
  }

  @Get()
  findAll(@GetUser() user: any, @Query('userId') userId?: string, @Query('projectId') projectId?: string) {
    if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return this.timeEntriesService.findAll(user.companyId, user.id, projectId);
    }
    return this.timeEntriesService.findAll(user.companyId, userId, projectId);
  }

  @Get('active')
  findActive(@GetUser() user: any, @Query('userId') userId?: string) {
    if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return this.timeEntriesService.findActive(user.companyId, user.id);
    }
    return this.timeEntriesService.findActive(user.companyId, userId);
  }

  @Get('my')
  findMyEntries(@GetUser() user: any) {
    return this.timeEntriesService.findAll(user.companyId, user.id);
  }

  @Get('activities')
  findActivities(@GetUser() user: any, @Query('userId') userId?: string, @Query('limit') limit?: string) {
    let parsedLimit = 100;
    if (limit) {
      const parsed = parseInt(limit, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 1000) {
        parsedLimit = parsed;
      }
    }

    if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      return this.timeEntriesService.findAllActivities(user.companyId, user.id, parsedLimit);
    }
    return this.timeEntriesService.findAllActivities(user.companyId, userId, parsedLimit);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: any) {
    return this.timeEntriesService.findOne(id, user.companyId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTimeEntryDto: UpdateTimeEntryDto, @GetUser() user: any) {
    return this.timeEntriesService.update(id, updateTimeEntryDto, user.companyId, user.id, user.role);
  }

  @Put(':id/stop')
  stop(@Param('id') id: string, @GetUser() user: any) {
    return this.timeEntriesService.stop(id, user.companyId, user.id, user.role);
  }

  @Put(':id/pause')
  pause(@Param('id') id: string, @GetUser() user: any) {
    return this.timeEntriesService.pause(id, user.companyId, user.id, user.role);
  }

  @Put(':id/resume')
  resume(@Param('id') id: string, @GetUser() user: any) {
    return this.timeEntriesService.resume(id, user.companyId, user.id, user.role);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @GetUser() user: any) {
    return this.timeEntriesService.remove(id, user.companyId, user.id, user.role);
  }
}

