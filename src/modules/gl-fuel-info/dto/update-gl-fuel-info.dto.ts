import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject, IsNumber, Min } from 'class-validator';


export class UpdateGlFuelInfoDto {
@ApiPropertyOptional({ example: 'G', description: '分类编号' })
@IsOptional()
@IsString()
category?: string;


@ApiPropertyOptional({ example: '某某铁矿', description: '原料名称' })
@IsOptional()
@IsString()
name?: string;


@ApiPropertyOptional({ example: { TFe: 60.1 }, description: '化学成分及指标 JSON 对象' })
@IsOptional()
@IsObject()
composition?: Record<string, any>;


@ApiPropertyOptional({ example: 1000, description: '库存数量' })
@IsOptional()
@IsNumber({}, { message: 'inventory 必须是数字' })
@Min(0, { message: '库存不能为负数' })
inventory?: number;

@ApiPropertyOptional({ example: '备注信息', description: '备注' })
@IsOptional()
@IsString()
remark?: string;
}