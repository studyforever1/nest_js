/**
 * 创建用户DTO
 * 用于接收管理员创建用户时的请求数据
 */
import { IsString, IsEmail, IsOptional, IsArray, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  /** 用户名（必填，唯一） */
  @ApiProperty({ example: 'admin' })
  @IsString()
  username: string;

  /** 密码（必填） */
  @ApiProperty({ example: 'admin123' })
  @IsString()
  password: string;

  /** 邮箱（可选） */
  @ApiPropertyOptional({ example: 'admin@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  /** 姓名（可选） */
  @ApiPropertyOptional({ example: '管理员' })
  @IsString()
  @IsOptional()
  fullName?: string;

  /** 手机号（可选） */
  @ApiPropertyOptional({ example: '13800000000', description: '手机号' })
  @IsString()
  @IsOptional()
  phone?: string;

  /** 头像路径（可选） */
  @ApiPropertyOptional({ example: '/uploads/avatars/avatar-1.png', description: '头像路径' })
  @IsString()
  @IsOptional()
  avatarPath?: string;

  /** 是否激活（可选，默认true） */
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  is_active?: boolean;

  /** 角色代码列表（可选，如 ['admin', 'user']） */
  @ApiPropertyOptional({ example: ['admin'] })
  @IsArray()
  @IsOptional()
  roles?: string[];

  /** 部门ID（可选，用于指定用户所属部门） */
  @ApiPropertyOptional({ example: 1, description: '部门ID' })
  @IsOptional()
  @IsNumber()
  departmentId?: number;
}
