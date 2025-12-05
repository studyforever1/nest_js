import { ApiProperty } from '@nestjs/swagger';

export class StartTaskResponseDto {
  @ApiProperty({ description: '任务 UUID', example: 'uuid-1234-5678' })
  taskUuid: string;

  @ApiProperty({ description: '任务结果映射（原料名称 → 结果）', type: Object })
  resultMap: Record<string, any>;
}

export class StopTaskResponseDto {
  @ApiProperty({ description: '任务 UUID', example: 'uuid-1234-5678' })
  taskUuid: string;

  @ApiProperty({ description: '任务状态', example: 'stopped' })
  status: string;
}

export class ProgressResponseDto {
  @ApiProperty({ description: '任务 UUID', example: 'uuid-1234-5678' })
  taskUuid: string;

  @ApiProperty({ description: '任务状态', example: 'running' })
  status: string;

  @ApiProperty({ description: '进度百分比', example: 40 })
  progress: number;

  @ApiProperty({ description: '总条目数', example: 100 })
  total: number;

  @ApiProperty({ description: '分页结果', type: [Object] })
  results: any[];

  @ApiProperty({ description: '当前页', example: 1 })
  page: number;

  @ApiProperty({ description: '每页条数', example: 10 })
  pageSize: number;

  @ApiProperty({ description: '总条数', example: 100 })
  totalResults: number;

  @ApiProperty({ description: '总页数', example: 10 })
  totalPages: number;
}
