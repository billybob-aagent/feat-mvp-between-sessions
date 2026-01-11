import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import * as cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpErrorFilter } from "./common/filters/http-exception.filter";
import type { Request, Response, NextFunction } from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - start;
      const path = (req.originalUrl || req.url || "").split("?")[0];
      console.log(`${req.method} ${path} ${res.statusCode} ${ms}ms`);
    });
    next();
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = req.originalUrl || req.url || "";
    if (path.startsWith("/api/v1")) {
      res.setHeader("Cache-Control", "no-store");
    }
    next();
  });

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix("api/v1");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new HttpErrorFilter());

  const envOrigins = (process.env.FRONTEND_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins =
    envOrigins.length > 0
      ? envOrigins
      : [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://127.0.0.1:3000",
          "http://127.0.0.1:3001",
        ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS blocked"), false);
    },
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);

  console.log(`API listening on http://localhost:${port}/api/v1`);
}

bootstrap();
