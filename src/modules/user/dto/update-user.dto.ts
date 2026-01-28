/**
 * 更新用户DTO
 * 用于接收更新用户时的请求数据，所有字段均为可选
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsArray, IsNumber } from 'class-validator';

export class UpdateUserDto {
  /** 用户名（可选） */
  @ApiPropertyOptional({ description: '用户名' })
  @IsOptional()
  @IsString()
  username?: string;

  /** 姓名（可选） */
  @ApiPropertyOptional({ description: '全名' })
  @IsOptional()
  @IsString()
  fullName?: string;

  /** 邮箱（可选） */
  @ApiPropertyOptional({ description: '邮箱' })
  @IsOptional()
  @IsString()
  email?: string;

  /** 手机号（可选） */
  @ApiPropertyOptional({ description: '手机号' })
  @IsOptional()
  @IsString()
  phone?: string;

  /** 头像路径（可选） */
  @ApiPropertyOptional({ description: '头像路径' })
  @IsOptional()
  @IsString()
  avatarPath?: string;

  /** 密码（可选，更新时会自动加密） */
  @ApiPropertyOptional({ description: '密码' })
  @IsOptional()
  @IsString()
  password?: string;

  /** 是否激活（可选） */
  @ApiPropertyOptional({ description: '是否激活' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  /** 角色代码列表（可选，如 ['admin', 'user']） */
  @ApiPropertyOptional({ description: '角色列表', type: [String] })
  @IsOptional()
  @IsArray()
  roles?: string[];

  /** 部门ID（可选，传 null 或 0 可移除部门关联） */
  @ApiPropertyOptional({ description: '部门ID', example: 1 })
  @IsOptional()
  @IsNumber()
  departmentId?: number;
}
