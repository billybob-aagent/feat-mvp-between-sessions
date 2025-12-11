import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as csurf from 'csurf';
import { json, raw } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const express = app.getHttpAdapter().getInstance?.();
  if (express && typeof express.set === 'function') {
    express.set('trust proxy', 1);
  }

  // CORS
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: allowed.length ? allowed : [/^https?:\/\/(localhost|127\.0\.0\.1)(:\\d+)?$/],
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Security headers with CSP
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'https:'],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cookieParser());
  // Body limits
  app.use(json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));

  // Stripe webhook raw body (must precede body parsers for that route)
  app.use('/api/v1/webhooks/stripe', raw({ type: 'application/json' }));

  // Enforce HTTPS behind proxies in production
  app.use((req: any, res: any, next: any) => {
    if (process.env.NODE_ENV === 'production') {
      const proto = req.headers['x-forwarded-proto'];
      if (proto && proto !== 'https') {
        const host = req.headers['host'];
        return res.redirect(301, `https://${host}${req.originalUrl}`);
      }
    }
    next();
  });
  // CSRF protection for browser-originating non-API JSON routes may need tuning
  // Enabled but ignored for non-cookie flows like mobile clients.
  app.use(
    csurf({
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    }) as any,
  );

  const config = new DocumentBuilder()
    .setTitle('Between Sessions API')
    .setDescription('OpenAPI 3.1 for Between Sessions')
    .setVersion('1.0.0')
    .addCookieAuth('access_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
    })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
}
bootstrap();
