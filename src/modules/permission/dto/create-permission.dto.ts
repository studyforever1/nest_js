// src/modules/permission/dto/create-permission.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ example: 'user:create', description: '权限编码' })
  @IsString()
  permissionCode: string;

  @ApiProperty({ example: '创建用户', description: '权限名称' })
  @IsString()
  permissionName: string;

  @ApiProperty({ example: '允许创建用户', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
