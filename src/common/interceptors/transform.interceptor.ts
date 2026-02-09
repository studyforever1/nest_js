import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../response/response.dto';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const req = context.switchToHttp().getRequest();
    const url: string = req?.url || '';

    // 🚫 Swagger / OpenAPI
    if (url.startsWith('/api-docs') || url.includes('swagger')) {
      return next.handle();
    }

    // 🚫 静态资源
    if (url.startsWith('/uploads')) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: any) => {
        // ✅ 已经是统一响应结构，直接放行（关键）
        if (
          data &&
          typeof data === 'object' &&
          'code' in data &&
          'message' in data &&
          'data' in data
        ) {
          return data;
        }

        // ✅ 否则才封装
        return ApiResponse.success(data);
      }),
    );
  }
}
