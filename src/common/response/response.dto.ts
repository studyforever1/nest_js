import { ApiProperty } from '@nestjs/swagger';

export class ApiResponse<T = any> {
  @ApiProperty({
    example: 0,
    description: '业务状态码，0 表示成功，非 0 表示失败（通常等于 HTTP 状态码）',
  })
  code: number;

  @ApiProperty({
    example: 'success',
    description: '提示信息',
  })
  message: string;

  @ApiProperty({
    description: '返回数据，错误时固定为 null',
    required: false,
  })
  data?: T;

  constructor(code = 0, message = 'success', data?: T) {
    this.code = code;
    this.message = message;
    this.data = data;
  }

  /**
   * ✅ 成功返回
   * code 固定为 0
   */
  static success<T>(
    data?: T,
    message = 'success',
  ): ApiResponse<T> {
    return new ApiResponse<T>(0, message, data);
  }

  /**
   * ❌ 错误返回
   * code = HTTP 状态码（401 / 403 / 500 ...）
   */
  static error<T = any>(
    message = 'error',
    code: number = 500,        // 👈 默认不再是 1
  ): ApiResponse<T> {
    return new ApiResponse<T>(code, message, null as any);
  }
}
