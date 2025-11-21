// delete-role.dto.ts
import { IsArray, ArrayNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteRoleDto {
  @ApiProperty({ description: '角色ID数组', type: [Number], example: [1,2] })
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  roleIds: number[];
}
