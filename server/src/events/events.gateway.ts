import { WebSocketGateway, WebSocketServer, SubscribeMessage, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('EventsGateway');
  private connectedClients = new Map<string, Socket>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('JWT_SECRET') || 'secret',
      });

      let companyId = payload.companyId;

      if (!companyId) {
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { companyId: true },
        });

        if (!user) {
          throw new Error('User not found');
        }

        companyId = user.companyId;
      }

      client.data.userId = payload.sub;
      client.data.email = payload.email;
      client.data.companyId = companyId;

      this.connectedClients.set(client.id, client);

      this.logger.log(`Client ${client.id} connected (User: ${payload.email}, Company: ${companyId})`);

      client.join(`user:${payload.sub}`);
      client.join(`company:${companyId}`);

      this.server.to(`company:${companyId}`).emit('user:connected', {
        userId: payload.sub,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      this.logger.error(`Authentication error for client ${client.id}: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data.userId && client.data.companyId) {
      this.logger.log(`Client ${client.id} disconnected (User: ${client.data.userId})`);

      this.server.to(`company:${client.data.companyId}`).emit('user:disconnected', {
        userId: client.data.userId,
        timestamp: new Date().toISOString(),
      });
    }

    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    return { event: 'pong', data: { timestamp: new Date().toISOString() } };
  }

  broadcastStatsUpdate(stats: any, companyId?: string) {
    if (companyId) {
      this.server.to(`company:${companyId}`).emit('stats:update', {
        ...stats,
        timestamp: new Date().toISOString(),
      });
    } else {
      const extractedCompanyId = stats?.companyId;
      if (extractedCompanyId) {
        this.logger.warn(`broadcastStatsUpdate called without companyId, extracted from stats: ${extractedCompanyId}`);
        this.server.to(`company:${extractedCompanyId}`).emit('stats:update', {
          ...stats,
          timestamp: new Date().toISOString(),
        });
      } else {
        this.logger.error(`broadcastStatsUpdate called without companyId and cannot extract from stats. Not broadcasting.`);
      }
    }
  }

  broadcastActivity(activity: any, companyId?: string) {
    try {
      if (companyId) {
        const timestamp = activity.timestamp || new Date().toISOString();
        this.server.to(`company:${companyId}`).emit('activity:new', {
          ...activity,
          timestamp,
        });
      } else {
        const extractedCompanyId = activity?.companyId || activity?.user?.companyId;
        if (extractedCompanyId) {
          this.logger.warn(`broadcastActivity called without companyId, extracted from activity: ${extractedCompanyId}`);
          const timestamp = activity.timestamp || new Date().toISOString();
          this.server.to(`company:${extractedCompanyId}`).emit('activity:new', {
            ...activity,
            timestamp,
          });
        } else {
          this.logger.error(`broadcastActivity called without companyId and cannot extract from activity. Not broadcasting.`);
        }
      }
    } catch (error: any) {
      this.logger.error(`Error broadcasting activity: ${error.message}`, error);
    }
  }

  broadcastTimeEntryUpdate(timeEntry: any, companyId?: string) {
    if (companyId) {
      this.server.to(`company:${companyId}`).emit('time-entry:update', {
        ...timeEntry,
        timestamp: new Date().toISOString(),
      });
    } else {
      const extractedCompanyId = timeEntry?.user?.companyId || timeEntry?.companyId;
      if (extractedCompanyId) {
        this.logger.warn(`broadcastTimeEntryUpdate called without companyId, extracted from timeEntry: ${extractedCompanyId}`);
        this.server.to(`company:${extractedCompanyId}`).emit('time-entry:update', {
          ...timeEntry,
          timestamp: new Date().toISOString(),
        });
      } else {
        this.logger.error(`broadcastTimeEntryUpdate called without companyId and cannot extract from timeEntry. Not broadcasting.`);
      }
    }
  }

  notifyUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastScreenshotSettingsUpdate(settings: any, companyId?: string) {
    if (companyId) {
      this.server.to(`company:${companyId}`).emit('screenshot-settings:update', {
        ...settings,
        timestamp: new Date().toISOString(),
      });
    } else {
      const extractedCompanyId = settings?.companyId;
      if (extractedCompanyId) {
        this.logger.warn(`broadcastScreenshotSettingsUpdate called without companyId, extracted from settings: ${extractedCompanyId}`);
        this.server.to(`company:${extractedCompanyId}`).emit('screenshot-settings:update', {
          ...settings,
          timestamp: new Date().toISOString(),
        });
      } else {
        this.logger.error(`broadcastScreenshotSettingsUpdate called without companyId and cannot extract from settings. Not broadcasting.`);
      }
    }
  }
}

