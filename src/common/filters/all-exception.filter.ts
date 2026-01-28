import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
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

    // 🚫 1️⃣ Swagger / OpenAPI 相关请求，完全交给 Nest 原生处理
    if (
      url.startsWith('/api-docs') ||
      url.includes('swagger')
    ) {
      throw exception;
    }

    // ================= 正常业务异常处理 =================

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : 500;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception?.message || 'Internal Server Error';

    response.status(200).json(
      ApiResponse.error(
        typeof message === 'string' ? message : JSON.stringify(message),
      ),
    );
  }
}
