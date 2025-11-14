import { applyDecorators } from '@nestjs/common';
import { IsOptional, IsNumber, IsString, Min, Max, IsDate } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 化学成分字段验证装饰器
 * 
 * 用于验证化学成分含量字段，适用于TFe、CaO、SiO2等化学成分
 * 特点：
 * - 数值范围：0-100
 * - 精度：4位小数
 * - 可选字段
 * - 自动类型转换
 * 
 * @param description 字段描述，用于API文档
 * @returns 组合装饰器，包含验证规则和API文档配置
 * 
 * @example
 * ```typescript
 * export class CreateMaterialDto {
 *   @ChemicalComposition('TFe含量(%)')
 *   tfe?: number;
 * }
 * ```
 */
export function ChemicalComposition(description?: string) {
  return applyDecorators(
    ApiProperty({ 
      description: description || '化学成分含量(%)', 
      example: 62.5, 
      required: false,
      type: 'number',
      minimum: 0,
      maximum: 100
    }),
    IsOptional(),
    IsNumber({ maxDecimalPlaces: 4 }),
    Min(0),
    Max(100),
    Transform(({ value }) => parseFloat(value) || 0)
  );
}

/**
 * 价格字段验证装饰器
 * 
 * 用于验证价格相关字段，适用于各种价格、费用、成本等字段
 * 特点：
 * - 数值范围：≥0
 * - 精度：2位小数
 * - 可选字段
 * - 自动类型转换
 * 
 * @param description 字段描述，用于API文档
 * @returns 组合装饰器，包含验证规则和API文档配置
 * 
 * @example
 * ```typescript
 * export class CreateProductDto {
 *   @PriceField('产品价格(元/吨)')
 *   price?: number;
 * }
 * ```
 */
export function PriceField(description?: string) {
  return applyDecorators(
    ApiProperty({ 
      description: description || '价格', 
      example: 500.0, 
      required: false,
      type: 'number',
      minimum: 0
    }),
    IsOptional(),
    IsNumber({ maxDecimalPlaces: 2 }),
    Min(0),
    Transform(({ value }) => parseFloat(value) || 0)
  );
}

/**
 * 百分比字段验证装饰器
 * 
 * 用于验证百分比相关字段，适用于各种比率、百分比等字段
 * 特点：
 * - 数值范围：0-100
 * - 精度：2位小数
 * - 可选字段
 * - 自动类型转换
 * 
 * @param description 字段描述，用于API文档
 * @returns 组合装饰器，包含验证规则和API文档配置
 * 
 * @example
 * ```typescript
 * export class CreateConfigDto {
 *   @PercentageField('水分含量(%)')
 *   moisture?: number;
 * }
 * ```
 */
export function PercentageField(description?: string) {
  return applyDecorators(
    ApiProperty({ 
      description: description || '百分比(%)', 
      example: 5.0, 
      required: false,
      type: 'number',
      minimum: 0,
      maximum: 100
    }),
    IsOptional(),
    IsNumber({ maxDecimalPlaces: 2 }),
    Min(0),
    Max(100),
    Transform(({ value }) => parseFloat(value) || 0)
  );
}

/**
 * 必填字符串字段验证装饰器
 * 
 * 用于验证必填的字符串字段，如名称、编号等
 * 特点：
 * - 必填字段
 * - 自动去除首尾空格
 * - 可配置最大长度
 * - 自动生成API文档
 * 
 * @param description 字段描述，用于API文档
 * @param maxLength 最大长度限制，默认100
 * @returns 组合装饰器，包含验证规则和API文档配置
 * 
 * @example
 * ```typescript
 * export class CreateMaterialDto {
 *   @RequiredStringField('原料名称', 100)
 *   materialName: string;
 * }
 * ```
 */
export function RequiredStringField(description: string, maxLength: number = 100) {
  return applyDecorators(
    ApiProperty({ 
      description, 
      example: '示例值', 
      required: true,
      maxLength
    }),
    IsString(),
    Transform(({ value }) => value?.trim())
  );
}

/**
 * 可选字符串字段验证装饰器
 * 
 * 用于验证可选的字符串字段，如备注、描述等
 * 特点：
 * - 可选字段
 * - 自动去除首尾空格
 * - 可配置最大长度
 * - 自动生成API文档
 * 
 * @param description 字段描述，用于API文档
 * @param maxLength 最大长度限制，默认100
 * @returns 组合装饰器，包含验证规则和API文档配置
 * 
 * @example
 * ```typescript
 * export class CreateMaterialDto {
 *   @OptionalStringField('备注信息', 500)
 *   remark?: string;
 * }
 * ```
 */
export function OptionalStringField(description: string, maxLength: number = 100) {
  return applyDecorators(
    ApiProperty({ 
      description, 
      example: '示例值', 
      required: false,
      maxLength
    }),
    IsOptional(),
    IsString(),
    Transform(({ value }) => value?.trim())
  );
}

/**
 * 日期字段验证装饰器
 * 
 * 用于验证日期相关字段，支持必填和可选两种模式
 * 特点：
 * - 支持必填/可选模式
 * - 自动类型转换
 * - 标准日期格式
 * - 自动生成API文档
 * 
 * @param description 字段描述，用于API文档
 * @param required 是否必填，默认false
 * @returns 组合装饰器，包含验证规则和API文档配置
 * 
 * @example
 * ```typescript
 * export class CreateRecordDto {
 *   @DateField('创建日期', true)
 *   createDate: Date;
 * 
 *   @DateField('更新日期')
 *   updateDate?: Date;
 * }
 * ```
 */
export function DateField(description: string, required: boolean = false) {
  return applyDecorators(
    ApiProperty({ 
      description, 
      example: '2024-01-01', 
      required,
      type: 'string',
      format: 'date'
    }),
    required ? IsDate() : IsOptional(),
    Type(() => Date),
    Transform(({ value }) => value ? new Date(value) : undefined)
  );
}
