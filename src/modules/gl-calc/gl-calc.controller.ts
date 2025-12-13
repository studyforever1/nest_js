import { Controller, Post, Body, Get, Param, Query, UseGuards } from '@nestjs/common';
import { GlCalcService } from './gl-calc.service';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ApiOkResponseData, ApiErrorResponse } from '../../common/response/response.decorator';
import { GLStartTaskDto } from './dto/start-task.dto';
import { GLStartTaskResponseDto, GLStopTaskResponseDto, GLProgressResponseDto } from './dto/response.dto';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { GLStopTaskDto } from './dto/stop-task.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { GLPaginationDto } from './dto/pagination.dto';
import { Res } from '@nestjs/common';
import type { Response } from 'express';
import { GLGetSchemeDto } from './dto/get-scheme.dto';
import { GLExportSchemeDto } from './dto/export-scheme.dto';
import { ApiResponse } from '../../common/response/response.dto'

@ApiBearerAuth('JWT')
@ApiTags('单独高炉计算任务接口')
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
  @ApiOkResponseData(GLStopTaskResponseDto)
  @ApiErrorResponse()
  stopTask(@Body() dto: GLStopTaskDto) {
    return this.glCalcService.stopTask(dto.task_id);
  }

  @Get('progress/:task_id')
  @Permissions('gl:calc')
  @ApiOperation({ summary: '查询GL任务进度', description: '支持分页和排序' })
  @ApiParam({ name: 'task_id', description: '任务ID，由 /start 返回', required: true })
  @ApiOkResponseData(GLProgressResponseDto)
  @ApiErrorResponse()
  async getProgress(@Param('task_id') task_id: string, @Query() pagination: GLPaginationDto) {
    return this.glCalcService.fetchAndSaveProgress(task_id, pagination);
  }
  
  // Controller
@Get('scheme')
@Permissions('sj:calc')
@ApiOperation({
  summary: '获取指定任务的某个方案信息',
  description: '根据 taskUuid 和方案序号 index 获取该方案的详细计算结果',
})
@ApiErrorResponse()
async getScheme(
  @Query() dto: GLGetSchemeDto,
  @CurrentUser() user: User,
): Promise<ApiResponse<any>> {
  // 直接返回 Service 的 ApiResponse
  return await this.glCalcService.getSchemeByIndex(dto.taskUuid, dto.index);
}

}
