import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 创建部门DTO
 * 用于接收创建部门时的请求数据
 */
export class CreateDepartmentDto {
  /** 部门名称（必填，最大长度100字符，唯一） */
  @ApiProperty({ description: '部门名称', example: '生产部' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  /** 部门描述（可选，最大长度255字符） */
  @ApiPropertyOptional({ description: '部门描述', example: '负责生产相关工作' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}

