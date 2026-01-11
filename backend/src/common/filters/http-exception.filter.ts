import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";

type ErrorPayload = {
  ok: false;
  statusCode: number;
  error: string;
  message: string;
  timestamp: string;
  path: string;
};

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const path = request.originalUrl?.split("?")[0] ?? request.url ?? "";
    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const payload = res as { message?: string | string[]; error?: string };
      const rawMessage = Array.isArray(payload?.message)
        ? payload?.message.join(", ")
        : payload?.message ?? "Request failed";

      const body: ErrorPayload = {
        ok: false,
        statusCode: status,
        error: payload?.error ?? exception.name,
        message: typeof rawMessage === "string" ? rawMessage : "Request failed",
        timestamp,
        path,
      };

      response.status(status).json(body);
      return;
    }

    const body: ErrorPayload = {
      ok: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: "InternalServerError",
      message: "Internal server error",
      timestamp,
      path,
    };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}

