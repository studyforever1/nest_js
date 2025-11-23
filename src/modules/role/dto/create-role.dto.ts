// create-role.dto.ts
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'admin', description: '角色编码（唯一）' })
  @IsString()
  roleCode: string;

  @ApiProperty({ example: '管理员', description: '角色名称' })
  @IsString()
  roleName: string;

  @ApiProperty({ example: '系统管理员，拥有全部权限', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
