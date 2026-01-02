// dto/save-fixed-module-config.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional } from 'class-validator';

export class SaveFixedModuleConfigDto {
  @ApiProperty({
    description: '模块名称',
    example: '硫平衡计算',
    enum: ['烧结固定配料计算', '硫平衡计算'],
  })
  @IsIn(['烧结固定配料计算', '硫平衡计算'])
  moduleName: '烧结固定配料计算' | '硫平衡计算';

  @ApiPropertyOptional({
    description: '其他参数设置（整块覆盖）',
    example: {
      脱硫率: 0.8,
      其他费用: 63.36,
      烟气流量: 550000,
      S残存系数: 0.3,
      Pb残存系数: 0.8,
      K2O残存系数: 0.85,
      烧结矿产量: 7000,
      Na2O残存系数: 0.75,
      干基总残存修正值: 1.00503,
    },
  })
  @IsOptional()
  @IsObject()
  otherSettings?: Record<string, number>;

  @ApiPropertyOptional({
    description: '原料结果值（key = 原料ID，value = 配比或结果）',
    example: {
      '79': 0,
      '81': 0,
    },
  })
  @IsOptional()
  @IsObject()
  ingredientResults?: Record<string, number>;
}
