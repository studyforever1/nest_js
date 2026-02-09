import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from '../response/response.dto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const url = request.url || '';

    // 🚫 Swagger / OpenAPI 请求，交给 Nest 原生处理
    if (url.startsWith('/api-docs') || url.includes('swagger')) {
      throw exception;
    }

    // ================= 统一异常处理 =================

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Internal Server Error';

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && (res as any).message) {
        message = (res as any).message;
      }
    } else if (exception?.message) {
      message = exception.message;
    }

    // ❗关键：HTTP 状态码 = 异常状态码
    response.status(status).json(
      ApiResponse.error(message, status),
    );
  }
}
