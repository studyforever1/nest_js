// assign-permissions.dto.ts
import { IsString, IsArray, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignPermissionsDto {
  @ApiProperty({ description: '角色名称', example: 'admin' })
  @IsString()
  roleCode: string;

  @ApiProperty({ description: '权限编码数组', type: [String], example: ['烧结物料信息库', '烧结配料设置'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissionCodes: string[];
}
