import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private logger: PinoLogger,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (() => {
        const secret = configService.get('JWT_SECRET');
        if (!secret || secret === 'secret') {
          logger.warn('⚠️  WARNING: JWT_SECRET is not set or using default "secret". This is insecure in production!');
          if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET must be set in production environment');
          }
        }
        return secret || 'secret';
      })(),
    });
    this.logger.setContext(JwtStrategy.name);
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
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

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException();
    }

    if (payload.companyId && user.companyId !== payload.companyId) {
      this.logger.warn(
        {
          userId: user.id,
          tokenCompanyId: payload.companyId,
          dbCompanyId: user.companyId,
        },
        'Token companyId mismatch',
      );
      throw new UnauthorizedException('Token is invalid - user company mismatch');
    }

    return user;
  }
}

