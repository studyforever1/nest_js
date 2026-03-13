import { Controller, Post, Body, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { ApiOkResponseData, ApiErrorResponse } from '../../common/response/response.decorator';
import { ApiResponse } from '../../common/response/response.dto';

import { LlythCalcService } from './llyth-calc.service';
import { LLYTHStartTaskDto } from './dto/start-task.dto';
import { LLYTHStartTaskResponseDto, LLYTHStopTaskResponseDto, LLYTHProgressResponseDto } from './dto/response.dto';
import { LLYTHStopTaskDto } from './dto/stop-task.dto';
import { LLYTHPaginationDto } from  './dto/pagination.dto';
import { LLYTHGetSchemeDto } from './dto/get-scheme.dto';

@ApiBearerAuth('JWT')
@ApiTags('利润一体化计算任务接口')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('llyth')
export class LlythCalcController {
  constructor(private readonly llythCalcService: LlythCalcService) {}

  // 启动任务
  @Post('start')
  @Permissions('llyth:calc')
  @ApiOperation({ summary: '启动利润一体化计算任务', description: '计算类型填:利润一体化配料计算' })
  @ApiOkResponseData(LLYTHStartTaskResponseDto)
  @ApiErrorResponse()
  startTask(@CurrentUser() user: User, @Body() dto: LLYTHStartTaskDto) {
    return this.llythCalcService.startTask(dto.calculateType, user);
  }

  // 停止任务
  @Post('stop')
  @Permissions('llyth:calc')
  @ApiOperation({ summary: '停止利润一体化计算任务', description: '根据 task_id 停止正在运行的任务' })
  @ApiOkResponseData(LLYTHStopTaskResponseDto)
  @ApiErrorResponse()
  stopTask(@Body() dto: LLYTHStopTaskDto) {
    return this.llythCalcService.stopTask(dto.task_id);
  }

  // 查询任务进度
  @Get('progress/:task_id')
  @Permissions('llyth:calc')
  @ApiOperation({ summary: '查询利润一体化计算任务进度' })
  @ApiParam({ name: 'task_id', description: '可以按照默认 主要参数.吨材毛利润', required: true })
  @ApiOkResponseData(LLYTHProgressResponseDto)
  @ApiErrorResponse()
  async getProgress(@Param('task_id') task_id: string, @Query() pagination: LLYTHPaginationDto) {
    return this.llythCalcService.fetchAndSaveProgress(task_id, pagination);
  }

  // 获取指定方案
  @Get('scheme')
  @Permissions('llyth:calc')
  @ApiOperation({
    summary: '获取指定任务的某个方案信息',
    description: '根据 taskUuid 和方案序号 index 获取该方案的详细计算结果',
  })
  @ApiErrorResponse()
  async getScheme(@Query() dto: LLYTHGetSchemeDto, @CurrentUser() user: User): Promise<ApiResponse<any>> {
    return await this.llythCalcService.getSchemeByIndex(dto.taskUuid, dto.index);
  }


  @Post('pause')
  @Permissions('sj-calc')
  @ApiOperation({
    summary: '暂停计算任务',
    description: '根据 task_id 暂停正在执行的烧结计算任务。',
  })
  @ApiOkResponseData(LLYTHStopTaskResponseDto)
  @ApiErrorResponse()
  pauseTask(@Body() dto: LLYTHStopTaskDto) {
    return this.llythCalcService.pauseTask(dto.task_id);
  }
  
  /**
   * 继续计算任务
   */
  @Post('resume')
  @Permissions('sj-calc')
  @ApiOperation({
    summary: '继续计算任务',
    description: '根据 task_id 继续之前暂停的烧结计算任务。',
  })
  @ApiOkResponseData(LLYTHStopTaskResponseDto)
  @ApiErrorResponse()
  resumeTask(@Body() dto: LLYTHStopTaskDto) {
    return this.llythCalcService.resumeTask(dto.task_id);
  }
}
