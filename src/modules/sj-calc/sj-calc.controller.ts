import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { CalcService } from './sj-calc.service';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ApiOkResponseData, ApiErrorResponse } from '../../common/response/response.decorator';
import { StartTaskDto } from './dto/start-task.dto';
import { StartTaskResponseDto, StopTaskResponseDto, ProgressResponseDto } from './dto/response.dto';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { StopTaskDto } from './dto/stop-task.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';

@ApiBearerAuth('JWT')
@ApiTags('烧结计算任务接口')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('sj')
export class CalcController {
  constructor(private readonly calcService: CalcService) {}

  /**
   * 启动计算任务
   */
  @Post('start')
  @Permissions('sj:calc')
  @ApiOperation({
    summary: '区间品位配料下的成本优化计算按钮',
    description: '启动计算任务，返回 task_id 用于后续查询进度以及停止计算。'
  })
  @ApiOkResponseData(StartTaskResponseDto)
  @ApiErrorResponse()
  startTask(
    @CurrentUser() user: User,
    @Body() dto: StartTaskDto,
  ) {
    return this.calcService.startTask(dto.calculateType, user);
  }

  /**
   * 停止指定的计算任务
   */
  @Post('stop')
  @Permissions('sj-calc')
  @ApiOperation({
    summary: '停止计算按钮',
    description: '根据 task_id 终止正在执行的烧结计算任务。',
  })
  @ApiOkResponseData(StopTaskResponseDto)
  @ApiErrorResponse()
  stopTask(@Body() dto: StopTaskDto) {
    return this.calcService.stopTask(dto.task_id);
  }

  /**
   * 查询任务进度
   */
  @Get('progress/:task_id')
  @Permissions('sj-calc')
  @ApiOperation({
    summary: '查询任务进度',
    description: '查询指定 task_id 的实时计算进度和当前状态，用于实现滚动条效果。',
  })
  @ApiParam({
    name: 'task_id',
    description: '任务 ID，由 /start 返回',
    required: true,
  })
  @ApiOkResponseData(ProgressResponseDto)
  @ApiErrorResponse()
  getProgress(@Param('task_id') task_id: string) {
    return this.calcService.fetchAndSaveProgress(task_id);
  }

  /**
   * 查询任务详情（结束后完整结果）
   */
  @Get('task/:task_id')
  @Permissions('sj-calc')
  @ApiOperation({
    summary: '查询任务详情',
    description: '查询一次计算任务的最终结果详情（适用于已经结束的任务）。',
  })
  @ApiParam({
    name: 'task_id',
    description: '任务 ID，由 /start 返回',
    required: true,
  })
  @ApiOkResponseData(ProgressResponseDto)
  @ApiErrorResponse()
  getTaskDetails(@Param('task_id') task_id: string) {
    return this.calcService.getTaskDetails(task_id);
  }

}
