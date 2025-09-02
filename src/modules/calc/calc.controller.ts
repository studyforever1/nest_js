// src/calc/calc.controller.ts
import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { CalcService } from './calc.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApiOkResponseData, ApiErrorResponse } from '../../common/response/response.decorator';
import { StartTaskDto } from './dto/start-task.dto';
import { StartTaskResponseDto, StopTaskResponseDto, ProgressResponseDto } from './dto/response.dto';

@ApiTags('烧结计算任务')
@Controller('sj')
export class CalcController {
  constructor(private readonly calcService: CalcService) {}

  /** 启动计算任务 */
  @Post('start')
  @ApiOperation({ summary: '启动计算任务' })
  @ApiOkResponseData(StartTaskResponseDto)
  @ApiErrorResponse()
  async start(@Body() body: StartTaskDto) {
    return this.calcService.startTask(body, body.userId);
  }

  /** 停止计算任务 */
  @Post('stop')
  @ApiOperation({ summary: '停止计算任务' })
  @ApiOkResponseData(StopTaskResponseDto)
  @ApiErrorResponse()
  async stop(@Body('task_id') task_id: string) {
    return this.calcService.stopTask(task_id);
  }

  /** 查询任务进度 */
  @Get('progress/:task_id')
  @ApiOperation({ summary: '查询任务进度' })
  @ApiOkResponseData(ProgressResponseDto)
  @ApiErrorResponse()
  async getProgress(@Param('task_id') task_id: string) {
    return this.calcService.fetchAndSaveProgress(task_id);
  }

  /** 查询任务详情，包括结果和日志 */
  @Get('task/:task_id')
  @ApiOperation({ summary: '查询任务详情' })
  @ApiOkResponseData(ProgressResponseDto) // 可以用 ApiResponse 包装任意对象
  @ApiErrorResponse()
  async getTask(@Param('task_id') task_id: string) {
    return this.calcService.getTaskDetails(task_id);
  }
}
