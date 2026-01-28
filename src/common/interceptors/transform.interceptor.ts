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

    // 🚫 1️⃣ Swagger / OpenAPI 相关请求直接放行（核心）
    if (
      url.startsWith('/api-docs') ||
      url.includes('swagger')
    ) {
      return next.handle();
    }

    // 🚫 2️⃣ 静态资源直接放行（如头像、文件）
    if (url.startsWith('/uploads')) {
      return next.handle();
    }

    // ✅ 3️⃣ 业务接口统一封装
    return next.handle().pipe(
      map((data) => {
        if (data instanceof ApiResponse) {
          return data; // 已经是统一格式
        }
        return ApiResponse.success(data); // 自动封装
      }),
    );
  }
}
