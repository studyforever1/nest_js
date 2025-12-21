import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class StartMixCoalCalcDto {
  @ApiProperty({ description: '计算类型', example: '混合煤性价比计算' })
  @IsString()
  calculateType: string;
}

export class StopMixCoalCalcDto {
  @ApiProperty({ description: '任务 UUID' })
  @IsString()
  taskUuid: string;
}

export class MixCoalPaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  pageSize?: number;
}
