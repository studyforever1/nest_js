import { ApiProperty } from '@nestjs/swagger';

export class ApiResponse<T> {
  @ApiProperty({
    example: 0,
    description: '业务状态码,0 表示成功，非 0 表示失败',
  })
  code: number;

  @ApiProperty({ example: '操作成功', description: '提示信息' })
  message: string;

  @ApiProperty({ description: '返回数据', required: false })
  data?: T;

  constructor(code = 0, message = 'success', data?: T) {
    this.code = code;
    this.message = message;
    this.data = data;
  }

  /** 成功返回 */
  static success<T>(data?: T, message = 'success'): ApiResponse<T> {
    return new ApiResponse<T>(0, message, data);
  }

  /** 错误返回，data 永远是 null */
  static error<T = any>(message = 'error', code = 1): ApiResponse<T> {
    return new ApiResponse<T>(code, message, null as any);
  }
}
