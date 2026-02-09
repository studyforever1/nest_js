import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class DateTimeInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    return next.handle().pipe(
      map((res) => {
        /**
         * ✅ 只处理统一响应结构里的 data
         * ❌ 绝不重新包装整个响应
         */
        if (res && typeof res === 'object' && 'data' in res) {
          return {
            ...res,
            data: this.convertDates(res.data),
          };
        }

        // 兜底：非统一结构（极少数场景）
        return this.convertDates(res);
      }),
    );
  }

  private convertDates(value: any): any {
    if (value === null || value === undefined) return value;

    // Date 对象 → 北京时间字符串
    if (value instanceof Date) {
      return dayjs(value)
        .tz('Asia/Shanghai')
        .format('YYYY-MM-DD HH:mm:ss');
    }

    // 数组递归处理
    if (Array.isArray(value)) {
      return value.map((item) => this.convertDates(item));
    }

    // 普通对象递归处理（原地修改，不 clone）
    if (typeof value === 'object') {
      Object.keys(value).forEach((key) => {
        value[key] = this.convertDates(value[key]);
      });
      return value;
    }

    // 基本类型
    return value;
  }
}
