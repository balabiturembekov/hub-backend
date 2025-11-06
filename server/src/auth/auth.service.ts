import { Injectable, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (dto.companyDomain) {
      const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      if (!domainRegex.test(dto.companyDomain)) {
        throw new BadRequestException('Invalid domain format. Domain must be a valid domain name (e.g., example.com)');
      }
    }

    if (dto.hourlyRate !== undefined) {
      if (dto.hourlyRate < 0) {
        throw new BadRequestException('Hourly rate cannot be negative');
      }
      if (dto.hourlyRate > 10000) {
        throw new BadRequestException('Hourly rate cannot exceed $10,000 per hour');
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const userRole = dto.role === 'SUPER_ADMIN' ? 'OWNER' : dto.role || 'OWNER';

    const result = await this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findFirst({
        where: { email: dto.email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      if (dto.companyDomain) {
        const existingCompany = await tx.company.findUnique({
          where: { domain: dto.companyDomain },
        });

        if (existingCompany) {
          throw new ConflictException('Company with this domain already exists');
        }
      }

      const company = await tx.company.create({
        data: {
          name: dto.companyName,
          domain: dto.companyDomain || null,
        },
      });

      const user = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
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
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
      include: { company: true },
    });

    let isPasswordValid = false;
    if (user) {
      isPasswordValid = await bcrypt.compare(dto.password, user.password);
    } else {
      const dummyHash = '$2b$10$dummy.hash.to.prevent.timing.attacks.here';
      await bcrypt.compare(dto.password, dummyHash);
    }

    if (!user || !isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is inactive');
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

    return user;
  }
}

