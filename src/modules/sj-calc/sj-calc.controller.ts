import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { CalcService } from './sj-calc.service';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  ApiOkResponseData,
  ApiErrorResponse,
} from '../../common/response/response.decorator';
import { StartTaskDto } from './dto/start-task.dto';
import {
  StartTaskResponseDto,
  StopTaskResponseDto,
  ProgressResponseDto,
} from './dto/response.dto';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { StopTaskDto } from './dto/stop-task.dto';

@ApiBearerAuth('JWT')
@ApiTags('烧结计算任务')
@Controller('sj')
export class CalcController {
  constructor(private readonly calcService: CalcService) {}

  /** 启动计算任务（需要 calc:start 权限） */
  @Post('start')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions('calc:start')
  @ApiOperation({ summary: '启动计算任务' })
  @ApiOkResponseData(StartTaskResponseDto)
  @ApiErrorResponse()
  async start(@Body() body: StartTaskDto) {
    return this.calcService.startTask(body, body.userId);
  }

  /** 停止计算任务（需要 calc:stop 权限） */
  @Post('stop')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions('calc:stop')
  @ApiOperation({ summary: '停止计算任务' })
  @ApiOkResponseData(StopTaskResponseDto)
  @ApiErrorResponse()
  async stop(@Body() body: StopTaskDto) {
    return this.calcService.stopTask(body.task_id);
  }

  /** 查询任务进度（需要 calc:view 权限） */
  @Get('progress/:task_id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions('calc:details')
  @ApiOperation({ summary: '查询任务进度' })
  @ApiOkResponseData(ProgressResponseDto)
  @ApiErrorResponse()
  async getProgress(@Param('task_id') task_id: string) {
    return this.calcService.fetchAndSaveProgress(task_id);
  }

  /** 查询任务详情（需要 calc:view 权限） */
  @Get('task/:task_id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions('calc:details')
  @ApiOperation({ summary: '查询任务详情' })
  @ApiOkResponseData(ProgressResponseDto)
  @ApiErrorResponse()
  async getTask(@Param('task_id') task_id: string) {
    return this.calcService.getTaskDetails(task_id);
  }
}
