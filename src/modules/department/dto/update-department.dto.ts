import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 更新部门DTO
 * 用于接收更新部门时的请求数据，所有字段均为可选
 */
export class UpdateDepartmentDto {
  /** 部门名称（可选，最大长度100字符） */
  @ApiPropertyOptional({ description: '部门名称', example: '生产部' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  /** 部门描述（可选，最大长度255字符） */
  @ApiPropertyOptional({ description: '部门描述', example: '负责生产相关工作' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}

