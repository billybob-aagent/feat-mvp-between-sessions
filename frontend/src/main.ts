import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import * as csurf from 'csurf';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  /**
   * Global API prefix
   */
  app.setGlobalPrefix('api/v1');

  /**
   * Global validation
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  /**
   * Security headers
   */
  app.use(helmet());

  /**
   * Cookies (required for auth + refresh tokens)
   */
  app.use(cookieParser());

  /**
   * ✅ CSRF PROTECTION (NON-API ONLY)
   * ---------------------------------
   * - CSRF should NEVER apply to JSON APIs
   * - It WILL break Next.js fetch otherwise
   * - We only apply it to non-/api routes
   */
  const csrfProtection = csurf({
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  }) as any;

  app.use((req: any, res: any, next: any) => {
    const url = req.originalUrl || req.url || '';
    if (url.startsWith('/api/v1')) {
      return next();
    }
    return csrfProtection(req, res, next);
  });

  /**
   * Swagger / OpenAPI
   */
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

  /**
   * Start server
   */
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);

  console.log(`✅ API listening on http://localhost:${port}`);
}

bootstrap();

