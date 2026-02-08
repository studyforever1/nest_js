// common/interceptors/date-time.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class DateTimeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => this.convertDates(data))
    );
  }

  private convertDates(obj: any): any {
    if (obj === null || obj === undefined) return obj;

    // 处理数组
    if (Array.isArray(obj)) {
      return obj.map(item => this.convertDates(item));
    }

    // 处理对象
    if (typeof obj === 'object') {
      const result: any = {};
      for (const key of Object.keys(obj)) {
        const value = obj[key];

        if (value instanceof Date) {
          // 转北京时间字符串
          result[key] = dayjs(value).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
        } else if (typeof value === 'object') {
          result[key] = this.convertDates(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    }

    // 非对象直接返回
    return obj;
  }
}
