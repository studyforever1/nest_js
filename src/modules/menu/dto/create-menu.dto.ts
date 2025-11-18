import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateMenuDto {
  @ApiProperty({ example: 0, description: '父级菜单ID' })
  @IsNumber()
  @IsOptional()
  parentId?: number = 0;

  @ApiProperty({ example: '系统管理' })
  @IsString()
  name: string;

  @ApiProperty({ example: 2, description: '类型：目录2，菜单1，按钮4' })
  @IsNumber()
  type: number;

  @ApiProperty({ example: '/system', required: false })
  @IsOptional()
  @IsString()
  routeName?: string;

  @ApiProperty({ example: '/system', required: false })
  @IsOptional()
  @IsString()
  routePath?: string;

  @ApiProperty({ example: 'Layout', required: false })
  @IsOptional()
  @IsString()
  component?: string;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  sort?: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  visible?: number;

  @ApiProperty({ example: 'system', required: false })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ example: '', required: false })
  @IsOptional()
  @IsString()
  redirect?: string;

  @ApiProperty({ example: '', required: false })
  @IsOptional()
  @IsString()
  perm?: string;
}
