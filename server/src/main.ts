import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as express from 'express';
import helmet from 'helmet';
import { join } from 'path';
import { initSentry } from './sentry/sentry.config';

initSentry();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // CORS configuration - supports multiple origins (domain, IP, with/without port)
  const getAllowedOrigins = (): string[] => {
    if (process.env.NODE_ENV === 'production') {
      const origins: string[] = [];
      
      // Add FRONTEND_URL if provided
      if (process.env.FRONTEND_URL) {
        origins.push(process.env.FRONTEND_URL);
        // Also add without protocol if needed
        const urlWithoutProtocol = process.env.FRONTEND_URL.replace(/^https?:\/\//, '');
        origins.push(`http://${urlWithoutProtocol}`);
        origins.push(`https://${urlWithoutProtocol}`);
      }
      
      // Add FRONTEND_IP if provided (for IP-based access)
      if (process.env.FRONTEND_IP) {
        const ip = process.env.FRONTEND_IP;
        origins.push(`http://${ip}`);
        origins.push(`http://${ip}:3002`);
        origins.push(`https://${ip}`);
        origins.push(`https://${ip}:3002`);
      }
      
      // Add additional allowed origins from env (comma-separated)
      if (process.env.ALLOWED_ORIGINS) {
        const additional = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
        origins.push(...additional);
      }
      
      return origins.length > 0 ? [...new Set(origins)] : [];
    } else {
      // Development: allow localhost on different ports
      return [
        process.env.FRONTEND_URL || 'http://localhost:3002',
        'http://localhost:3000',
        'http://localhost:3002',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3002',
      ].filter(Boolean);
    }
  };

  const allowedOrigins = getAllowedOrigins();

  // Log allowed origins for debugging
  console.log('🔒 CORS Configuration:', {
    allowedOrigins,
    nodeEnv: process.env.NODE_ENV,
    frontendUrl: process.env.FRONTEND_URL,
    frontendIp: process.env.FRONTEND_IP,
  });

  app.enableCors({
    origin: allowedOrigins.length > 0 
      ? (origin, callback) => {
          // Allow requests with no origin for:
          // 1. Health checks (GET /api)
          // 2. OPTIONS preflight requests
          // 3. Internal requests from Nginx/Docker
          if (!origin) {
            // Get request info from callback context (if available)
            // For now, allow in production for health checks and internal requests
            // Nginx should add Origin header, but we allow without it for compatibility
            if (process.env.NODE_ENV === 'production') {
              // In production, allow requests without origin for health checks
              // but log them for monitoring
              console.log('CORS: Allowing request with no origin (likely health check or internal request)');
              return callback(null, true);
            }
            // Allow in development for testing
            console.log('CORS: Allowing request with no origin (development mode)');
            return callback(null, true);
          }
          
          if (allowedOrigins.includes(origin)) {
            console.log(`CORS: Allowing origin: ${origin}`);
            callback(null, true);
          } else {
            // Log for debugging
            console.warn(`CORS: Blocked origin: ${origin}`);
            console.warn(`CORS: Allowed origins are:`, allowedOrigins);
            callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
          }
        }
      : true, // Fallback: allow all in development if no origins specified
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Server is running on http://localhost:${port}/api`);
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

