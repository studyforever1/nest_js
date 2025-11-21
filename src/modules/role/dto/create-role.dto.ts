// create-role.dto.ts
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ description: '角色名称', example: 'manager' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '角色描述', example: '管理者角色' })
  @IsOptional()
  @IsString()
  description?: string;
}
