import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable()
export class MaterialResponseInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    return next.handle().pipe(
      map((response) => {
        // ✅ 适配：data 直接是数组
        if (!response || !Array.isArray(response.data)) {
          return response;
        }

        response.data = response.data.map((item) => {
          const {
            name,
            category,
            inventory,
            origin,
            remark,
            port,   // 新增解构 port
            ...rest
          } = item;

          return {
            ...rest,
            物料名称: name,
            分类编号: category,
            库存: inventory,
            产地: origin,
            港口: port,    // 映射 port → 港口
            备注: remark,
          };
        });

        return response;
      }),
    );
  }
}