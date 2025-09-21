import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, ArrayNotEmpty } from 'class-validator';

export class AssignPermissionsDto {
  @ApiProperty({ description: '角色编码，例如 sj_user' })
  @IsString()
  @IsNotEmpty()
  roleCode: string;

  @ApiProperty({
    description: '权限编码数组，例如 ["calc:start","calc:stop"]',
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissionCodes: string[];
}
