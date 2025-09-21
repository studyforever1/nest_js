import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { CalcService } from './sj-calc.service';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApiOkResponseData, ApiErrorResponse } from '../../common/response/response.decorator';
import { StartTaskDto } from './dto/start-task.dto';
import { StartTaskResponseDto, StopTaskResponseDto, ProgressResponseDto } from './dto/response.dto';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { StopTaskDto } from './dto/stop-task.dto';

@ApiBearerAuth('JWT')
@ApiTags('烧结计算任务')
@UseGuards(AuthGuard('jwt'), PermissionsGuard) // 类级别统一
@Controller('sj')
export class CalcController {
  constructor(private readonly calcService: CalcService) {}

  /** 启动计算任务 */
  @Post('start')
  @Permissions('calc:start')
  @ApiOperation({ summary: '启动计算任务' })
  @ApiOkResponseData(StartTaskResponseDto)
  @ApiErrorResponse()
  startTask(@Body() dto: StartTaskDto) {
    return this.calcService.startTask(dto, dto.userId);
  }

  /** 停止计算任务 */
  @Post('stop')
  @Permissions('calc:stop')
  @ApiOperation({ summary: '停止计算任务' })
  @ApiOkResponseData(StopTaskResponseDto)
  @ApiErrorResponse()
  stopTask(@Body() dto: StopTaskDto) {
    return this.calcService.stopTask(dto.task_id);
  }

  /** 查询任务进度 */
  @Get('progress/:task_id')
  @Permissions('calc:details')
  @ApiOperation({ summary: '查询任务进度' })
  @ApiOkResponseData(ProgressResponseDto)
  @ApiErrorResponse()
  getProgress(@Param('task_id') task_id: string) {
    return this.calcService.fetchAndSaveProgress(task_id);
  }

  /** 查询任务详情 */
  @Get('task/:task_id')
  @Permissions('calc:details')
  @ApiOperation({ summary: '查询任务详情' })
  @ApiOkResponseData(ProgressResponseDto)
  @ApiErrorResponse()
  getTaskDetails(@Param('task_id') task_id: string) {
    return this.calcService.getTaskDetails(task_id);
  }
}
