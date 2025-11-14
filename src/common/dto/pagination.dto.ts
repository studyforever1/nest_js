import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * 分页参数DTO
 * 
 * 用于处理分页查询的通用参数，包含页码和每页数量
 * 特点：
 * - 自动参数验证
 * - 默认值设置
 * - 范围限制
 * - 类型转换
 * 
 * @example
 * ```typescript
 * @Get()
 * async findAll(@Query() query: PaginationDto) {
 *   // 使用分页参数进行查询
 * }
 * ```
 */
export class PaginationDto {
  /** 页码，从1开始 */
  @ApiProperty({ 
    description: '页码', 
    example: 1, 
    required: false,
    minimum: 1
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value) || 1)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  /** 每页数量，范围1-100 */
  @ApiProperty({ 
    description: '每页数量', 
    example: 10, 
    required: false,
    minimum: 1,
    maximum: 100
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value) || 10)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

/**
 * 分页结果DTO
 * 
 * 用于返回分页查询的结果，包含数据列表和分页信息
 * 特点：
 * - 泛型支持，可适配任何数据类型
 * - 完整的分页信息
 * - 自动计算导航信息
 * - 标准化的响应格式
 * 
 * @template T 数据类型
 * 
 * @example
 * ```typescript
 * const result = new PaginatedResult<User>(users, 100, 1, 10);
 * // 返回: { data: users, total: 100, page: 1, limit: 10, totalPages: 10, hasNext: true, hasPrev: false }
 * ```
 */
export class PaginatedResult<T> {
  /** 数据列表 */
  @ApiProperty({ description: '数据列表' })
  data: T[];

  /** 总记录数 */
  @ApiProperty({ description: '总数' })
  total: number;

  /** 当前页码 */
  @ApiProperty({ description: '当前页' })
  page: number;

  /** 每页数量 */
  @ApiProperty({ description: '每页数量' })
  limit: number;

  /** 总页数 */
  @ApiProperty({ description: '总页数' })
  totalPages: number;

  /** 是否有下一页 */
  @ApiProperty({ description: '是否有下一页' })
  hasNext: boolean;

  /** 是否有上一页 */
  @ApiProperty({ description: '是否有上一页' })
  hasPrev: boolean;

  /**
   * 构造函数
   * 
   * @param data 数据列表
   * @param total 总记录数
   * @param page 当前页码
   * @param limit 每页数量
   */
  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
    this.hasNext = page < this.totalPages;
    this.hasPrev = page > 1;
  }
}

/**
 * 查询参数DTO
 * 
 * 继承分页参数，增加排序功能
 * 特点：
 * - 继承分页功能
 * - 支持字段排序
 * - 支持排序方向
 * - 默认排序配置
 * 
 * @example
 * ```typescript
 * @Get()
 * async findAll(@Query() query: QueryDto) {
 *   // 支持分页和排序的查询
 * }
 * ```
 */
export class QueryDto extends PaginationDto {
  /** 排序字段，默认为createdAt */
  @ApiProperty({ 
    description: '排序字段', 
    example: 'createdAt', 
    required: false 
  })
  @IsOptional()
  @Transform(({ value }) => value || 'createdAt')
  orderBy?: string = 'createdAt';

  /** 排序方向，默认为DESC */
  @ApiProperty({ 
    description: '排序方向', 
    example: 'DESC', 
    required: false,
    enum: ['ASC', 'DESC']
  })
  @IsOptional()
  @Transform(({ value }) => value?.toUpperCase() || 'DESC')
  orderDirection?: 'ASC' | 'DESC' = 'DESC';
}
