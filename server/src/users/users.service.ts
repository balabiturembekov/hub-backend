import {
  Injectable,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async create(dto: CreateUserDto, companyId: string, creatorRole: UserRole) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: dto.email,
        companyId,
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists in your company');
    }

    if (dto.role) {
      if (dto.role === UserRole.OWNER && creatorRole !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('You cannot create another owner. There can be only one owner per company.');
      }
      if (dto.role === UserRole.SUPER_ADMIN && creatorRole !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('You do not have permission to create a super admin user.');
      }
    } else {
      dto.role = UserRole.EMPLOYEE;
    }

    if (dto.hourlyRate !== undefined) {
      if (dto.hourlyRate < 0) {
        throw new BadRequestException('Hourly rate cannot be negative');
      }
      if (dto.hourlyRate > 10000) {
        throw new BadRequestException('Hourly rate cannot exceed $10,000 per hour');
      }
    }

    // Validate password strength
    if (dto.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }
    
    // Check password complexity (at least one letter and one number)
    const hasLetter = /[a-zA-Z]/.test(dto.password);
    const hasNumber = /[0-9]/.test(dto.password);
    if (!hasLetter || !hasNumber) {
      throw new BadRequestException('Password must contain at least one letter and one number');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12); // Increased salt rounds from 10 to 12 for better security

    const user = await this.prisma.user.create({
      data: {
        ...dto,
        password: hashedPassword,
        companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatar: true,
        hourlyRate: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.cache.invalidateUsers(companyId);
    return user;
  }

  async findAll(companyId: string) {
    const cacheKey = `users:${companyId}:all`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const users = await this.prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatar: true,
        hourlyRate: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.cache.set(cacheKey, users, 300);
    return users;
  }

  async findOne(id: string, companyId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatar: true,
        hourlyRate: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found in your company`);
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto, companyId: string, updaterRole: UserRole) {
    const existingUser = await this.findOne(id, companyId);

    if (dto.email) {
      const existingUserWithEmail = await this.prisma.user.findFirst({
        where: {
          email: dto.email,
          companyId,
        },
      });

      if (existingUserWithEmail && existingUserWithEmail.id !== id) {
        throw new ConflictException('User with this email already exists in your company');
      }
    }

    if (dto.role && dto.role !== existingUser.role) {
      if (dto.role === UserRole.OWNER && updaterRole !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('You cannot change a user\'s role to owner. There can be only one owner per company.');
      }
      if (existingUser.role === UserRole.OWNER && updaterRole !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('You cannot change the owner\'s role.');
      }
      if (dto.role === UserRole.SUPER_ADMIN && updaterRole !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('You do not have permission to assign super admin role.');
      }
      if (existingUser.role === UserRole.SUPER_ADMIN && updaterRole !== UserRole.SUPER_ADMIN) {
        throw new ForbiddenException('You do not have permission to change a super admin\'s role.');
      }
    }

    const updateData: any = { ...dto };
    if ('companyId' in updateData) {
      delete updateData.companyId;
    }

    if (dto.hourlyRate !== undefined) {
      if (dto.hourlyRate < 0) {
        throw new BadRequestException('Hourly rate cannot be negative');
      }
      if (dto.hourlyRate > 10000) {
        throw new BadRequestException('Hourly rate cannot exceed $10,000 per hour');
      }
    }

    if (dto.password) {
      if (!dto.password.trim()) {
        throw new BadRequestException('Password cannot be empty');
      }
      // Validate password strength
      if (dto.password.length < 8) {
        throw new BadRequestException('Password must be at least 8 characters long');
      }
      
      // Check password complexity (at least one letter and one number)
      const hasLetter = /[a-zA-Z]/.test(dto.password);
      const hasNumber = /[0-9]/.test(dto.password);
      if (!hasLetter || !hasNumber) {
        throw new BadRequestException('Password must contain at least one letter and one number');
      }

      updateData.password = await bcrypt.hash(dto.password, 12); // Increased salt rounds from 10 to 12 for better security
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatar: true,
        hourlyRate: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.cache.invalidateUsers(companyId);
    return updated;
  }

  async remove(id: string, companyId: string, deleterRole: UserRole) {
    const user = await this.findOne(id, companyId);

    if (user.role === UserRole.OWNER && deleterRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('You cannot delete the owner of the company');
    }

    if (user.role === UserRole.SUPER_ADMIN && deleterRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('You do not have permission to delete a super admin');
    }

    const deleted = await this.prisma.$transaction(async (tx) => {
      const activeEntries = await tx.timeEntry.findMany({
        where: {
          userId: id,
          status: {
            in: ['RUNNING', 'PAUSED'],
          },
          user: {
            companyId,
          },
        },
      });

      if (activeEntries.length > 0) {
        throw new BadRequestException(
          `Cannot delete user with active time entries. Please stop all running/paused timers first (${activeEntries.length} active timer${activeEntries.length > 1 ? 's' : ''}).`,
        );
      }

      return tx.user.delete({
        where: { id },
      });
    });

    await this.cache.invalidateUsers(companyId);
    return deleted;
  }
}

