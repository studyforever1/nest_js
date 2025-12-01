import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';


export class RemoveGlFuelInfoDto {
@ApiProperty({ example: [1,2,3], description: '要删除的原料ID列表' })
@IsArray()
@ArrayNotEmpty({ message: '至少提供一个要删除的ID' })
@Type(() => Number)
@IsInt({ each: true })
@Min(1, { each: true })
ids: number[];
}