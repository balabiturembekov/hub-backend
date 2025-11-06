import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  create(@Body() createUserDto: CreateUserDto, @GetUser() user: any) {
    return this.usersService.create(createUserDto, user.companyId, user.role);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  findAll(@GetUser() user: any) {
    return this.usersService.findAll(user.companyId);
  }

  @Get('me')
  getMyProfile(@GetUser() user: any) {
    return this.usersService.findOne(user.id, user.companyId);
  }

  @Patch('me')
  updateMyProfile(@GetUser() user: any, @Body() updateUserDto: UpdateUserDto) {
    if (updateUserDto.role && updateUserDto.role !== user.role) {
      delete updateUserDto.role;
    }
    if ('companyId' in updateUserDto) {
      delete updateUserDto.companyId;
    }
    return this.usersService.update(user.id, updateUserDto, user.companyId, user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetUser() user: any) {
    if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      if (id !== user.id) {
        throw new ForbiddenException('You can only view your own profile');
      }
    }
    return this.usersService.findOne(id, user.companyId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @GetUser() user: any) {
    return this.usersService.update(id, updateUserDto, user.companyId, user.role);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  remove(@Param('id') id: string, @GetUser() user: any) {
    if (id === user.id) {
      throw new ForbiddenException('You cannot delete your own account');
    }
    return this.usersService.remove(id, user.companyId, user.role);
  }
}

