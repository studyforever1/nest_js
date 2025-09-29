// src/calc/dto/response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class StartTaskResponseDto {
  @ApiProperty({ description: '任务ID' })
  taskId: string;
}

export class StopTaskResponseDto {
  @ApiProperty({ description: '任务UUID' })
  taskUuid: string;

  @ApiProperty({ description: '任务状态' })
  status: string;
}

export class ProgressResponseDto {
  @ApiProperty({ description: '任务状态' })
  status: string;

  @ApiProperty({ description: '任务进度', example: 50 })
  progress: number;

  @ApiProperty({ description: '总量', example: 100 })
  total: number;

  @ApiProperty({ description: '计算结果数组', type: [Object] })
  results: any[];
}



export class SaveHistoryResponseDto {
  @ApiProperty({ description: '保存的历史记录数量' })
  count: number;
}
