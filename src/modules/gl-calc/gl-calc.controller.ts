import { Controller, Post, Body, Get, Param, Query, UseGuards } from '@nestjs/common';
import { GlCalcService } from './gl-calc.service';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ApiOkResponseData, ApiErrorResponse } from '../../common/response/response.decorator';
import { GLStartTaskDto } from './dto/start-task.dto';
import { GLStartTaskResponseDto, StopTaskResponseDto, ProgressResponseDto } from './dto/response.dto';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { GLStopTaskDto } from './dto/stop-task.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { GLPaginationDto } from './dto/pagination.dto';

@ApiBearerAuth('JWT')
@ApiTags('GL计算任务接口')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('gl')
export class GlCalcController {
  constructor(private readonly glCalcService: GlCalcService) {}

  @Post('start')
  @Permissions('gl:calc')
  @ApiOperation({ summary: '启动GL计算任务', description: '返回 task_id 用于查询进度和停止任务' })
  @ApiOkResponseData(GLStartTaskResponseDto)
  @ApiErrorResponse()
  startTask(@CurrentUser() user: User, @Body() dto: GLStartTaskDto) {
    return this.glCalcService.startTask(dto.calculateType, user);
  }

  @Post('stop')
  @Permissions('gl:calc')
  @ApiOperation({ summary: '停止GL计算任务', description: '根据 task_id 停止正在运行的任务' })
  @ApiOkResponseData(StopTaskResponseDto)
  @ApiErrorResponse()
  stopTask(@Body() dto: GLStopTaskDto) {
    return this.glCalcService.stopTask(dto.task_id);
  }

  @Get('progress/:task_id')
  @Permissions('gl:calc')
  @ApiOperation({ summary: '查询GL任务进度', description: '支持分页和排序' })
  @ApiParam({ name: 'task_id', description: '任务ID，由 /start 返回', required: true })
  @ApiOkResponseData(ProgressResponseDto)
  @ApiErrorResponse()
  async getProgress(@Param('task_id') task_id: string, @Query() pagination: GLPaginationDto) {
    return this.glCalcService.fetchAndSaveProgress(task_id, pagination);
  }
}
