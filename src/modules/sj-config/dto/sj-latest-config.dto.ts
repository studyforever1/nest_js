import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

export class SJLatestConfigDto {
  @ApiPropertyOptional({
    description: '模块名称，可选模块',
    example: '烧结配料计算',
    enum: ['烧结配料计算', '烧结固定配料计算', '硫平衡计算'], // ✅ 这里指定下拉选项
  })
  @IsOptional()
  @IsString()
  @IsIn(['烧结配料计算', '烧结固定配料计算', '硫平衡计算']) // ✅ 校验前端传入值是否在枚举中
  module?: string;
}
