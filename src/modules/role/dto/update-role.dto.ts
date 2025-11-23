// update-role.dto.ts
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty,ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRoleDto {
  @ApiProperty({ example: '管理员', required: false })
  @IsOptional()
  @IsString()
  roleName?: string;

  @ApiProperty({ example: '系统最高权限角色', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
