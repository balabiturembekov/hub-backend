import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TeamActivityService } from './team-activity.service';
import { TeamActivityQueryDto } from './dto/team-activity-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('team-activity')
@UseGuards(JwtAuthGuard)
export class TeamActivityController {
  constructor(private readonly teamActivityService: TeamActivityService) {}

  @Get()
  async getTeamActivity(@Query() query: TeamActivityQueryDto, @GetUser() user: any) {
    return this.teamActivityService.getTeamActivity(user.companyId, user.id, user.role, query);
  }
}

