import { Injectable, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PinoLogger } from 'nestjs-pino';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private logger: PinoLogger,
  ) {
    this.logger.setContext(AuthService.name);
  }

  async register(dto: RegisterDto) {
    // Normalize email to lowercase
    const normalizedEmail = dto.email.toLowerCase().trim();
    
    // Validate email is not empty after normalization
    if (!normalizedEmail || normalizedEmail.length === 0) {
      throw new BadRequestException('Email is required');
    }

    // Validate and sanitize name
    const sanitizedName = dto.name.trim();
    if (!sanitizedName || sanitizedName.length < 2) {
      throw new BadRequestException('Name must be at least 2 characters long');
    }

    // Validate and sanitize company name
    const sanitizedCompanyName = dto.companyName.trim();
    if (!sanitizedCompanyName || sanitizedCompanyName.length < 2) {
      throw new BadRequestException('Company name must be at least 2 characters long');
    }

    // Validate password strength
    const sanitizedPassword = dto.password.trim();
    if (sanitizedPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }
    if (sanitizedPassword.length > 128) {
      throw new BadRequestException('Password must not exceed 128 characters');
    }
    
    // Check password complexity (at least one letter and one number)
    const hasLetter = /[a-zA-Z]/.test(sanitizedPassword);
    const hasNumber = /[0-9]/.test(sanitizedPassword);
    if (!hasLetter || !hasNumber) {
      throw new BadRequestException('Password must contain at least one letter and one number');
    }

    // Validate and normalize companyDomain
    let normalizedDomain: string | null = null;
    if (dto.companyDomain && dto.companyDomain.trim() !== '') {
      const trimmedDomain = dto.companyDomain.trim().toLowerCase();
      const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      if (!domainRegex.test(trimmedDomain)) {
        throw new BadRequestException('Invalid domain format. Domain must be a valid domain name (e.g., example.com)');
      }
      normalizedDomain = trimmedDomain;
    }

    if (dto.hourlyRate !== undefined) {
      if (dto.hourlyRate < 0) {
        throw new BadRequestException('Hourly rate cannot be negative');
      }
      if (dto.hourlyRate > 10000) {
        throw new BadRequestException('Hourly rate cannot exceed $10,000 per hour');
      }
    }

    const hashedPassword = await bcrypt.hash(sanitizedPassword, 12); // Increased salt rounds from 10 to 12 for better security
    const userRole = dto.role === 'SUPER_ADMIN' ? 'OWNER' : dto.role || 'OWNER';

    const result = await this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findFirst({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      if (normalizedDomain) {
        const existingCompany = await tx.company.findUnique({
          where: { domain: normalizedDomain },
        });

        if (existingCompany) {
          throw new ConflictException('Company with this domain already exists');
        }
      }

      const company = await tx.company.create({
        data: {
          name: sanitizedCompanyName,
          domain: normalizedDomain,
        },
      });

      const user = await tx.user.create({
        data: {
          name: sanitizedName,
          email: normalizedEmail,
          password: hashedPassword,
          role: userRole,
          avatar: dto.avatar,
          hourlyRate: dto.hourlyRate,
          companyId: company.id,
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
        },
      });

      return { user, company };
    });

    const { user, company } = result;

    return {
      user,
      access_token: this.jwtService.sign({
        sub: user.id,
        email: user.email,
        companyId: company.id,
      }),
    };
  }

  async login(dto: LoginDto) {
    // Normalize email to lowercase
    const normalizedEmail = dto.email.toLowerCase().trim();
    
    // Validate email is not empty after normalization
    if (!normalizedEmail || normalizedEmail.length === 0) {
      throw new BadRequestException('Email is required');
    }

    // Validate password is not empty
    const sanitizedPassword = dto.password.trim();
    if (!sanitizedPassword || sanitizedPassword.length === 0) {
      throw new BadRequestException('Password is required');
    }
    
    // Check password length to prevent DoS
    if (sanitizedPassword.length > 128) {
      throw new BadRequestException('Password must not exceed 128 characters');
    }

    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
      include: { company: true },
    });

    let isPasswordValid = false;
    if (user) {
      isPasswordValid = await bcrypt.compare(sanitizedPassword, user.password);
    } else {
      // Use a valid bcrypt hash to prevent timing attacks
      // This is a valid bcrypt hash with cost factor 12
      const dummyHash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqBWVHxkd0';
      await bcrypt.compare(sanitizedPassword, dummyHash);
    }

    if (!user || !isPasswordValid) {
      this.logger.warn(
        {
          email: normalizedEmail,
          hasUser: !!user,
          isPasswordValid,
        },
        'Failed login attempt',
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is inactive');
    }

    // Check if company exists
    if (!user.company) {
      throw new UnauthorizedException('User company not found');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      companyId: user.companyId,
    };

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        hourlyRate: user.hourlyRate,
        companyId: user.companyId,
        company: {
          id: user.company.id,
          name: user.company.name,
        },
      },
      access_token: this.jwtService.sign(payload),
    };
  }

  async validateUser(userId: string) {
    if (!userId) {
      return null;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      this.logger.warn(
        {
          userId,
        },
        'Invalid user ID format in validateUser',
      );
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatar: true,
        hourlyRate: true,
        companyId: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Check if company exists (may be null if company was deleted)
    if (user && !user.company) {
      this.logger.warn(
        {
          userId: user.id,
          companyId: user.companyId,
        },
        'User has no associated company',
      );
    }

    return user; // May be null - this is expected behavior
  }
}

