import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('screenshot-settings')
  async getScreenshotSettings(@GetUser() user: any) {
    return this.companiesService.getScreenshotSettings(user.companyId);
  }

  @Patch('screenshot-settings')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async updateScreenshotSettings(@GetUser() user: any, @Body() settings: { screenshotEnabled?: boolean; screenshotInterval?: number }) {
    return this.companiesService.updateScreenshotSettings(user.companyId, settings);
  }
}

