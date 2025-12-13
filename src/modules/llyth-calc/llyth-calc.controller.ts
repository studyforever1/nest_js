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
import { GLStartTaskDto } from '../gl-calc/dto/start-task.dto';
import { GLStartTaskResponseDto, GLStopTaskResponseDto, GLProgressResponseDto } from '../gl-calc/dto/response.dto';
import { GLStopTaskDto } from '../gl-calc/dto/stop-task.dto';
import { GLPaginationDto } from '../gl-calc/dto/pagination.dto';
import { GLGetSchemeDto } from '../gl-calc/dto/get-scheme.dto';

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
  @ApiOkResponseData(GLStartTaskResponseDto)
  @ApiErrorResponse()
  startTask(@CurrentUser() user: User, @Body() dto: GLStartTaskDto) {
    return this.llythCalcService.startTask(dto.calculateType, user);
  }

  // 停止任务
  @Post('stop')
  @Permissions('llyth:calc')
  @ApiOperation({ summary: '停止利润一体化计算任务', description: '根据 task_id 停止正在运行的任务' })
  @ApiOkResponseData(GLStopTaskResponseDto)
  @ApiErrorResponse()
  stopTask(@Body() dto: GLStopTaskDto) {
    return this.llythCalcService.stopTask(dto.task_id);
  }

  // 查询任务进度
  @Get('progress/:task_id')
  @Permissions('llyth:calc')
  @ApiOperation({ summary: '查询利润一体化计算任务进度' })
  @ApiParam({ name: 'task_id', description: '任务ID，由 /start 返回', required: true })
  @ApiOkResponseData(GLProgressResponseDto)
  @ApiErrorResponse()
  async getProgress(@Param('task_id') task_id: string, @Query() pagination: GLPaginationDto) {
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
  async getScheme(@Query() dto: GLGetSchemeDto, @CurrentUser() user: User): Promise<ApiResponse<any>> {
    return await this.llythCalcService.getSchemeByIndex(dto.taskUuid, dto.index);
  }
}
