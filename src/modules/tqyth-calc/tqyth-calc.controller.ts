import { Controller, Post, Body, Get, Param, Query, UseGuards } from '@nestjs/common';
import { TqythCalcService } from './tqyth-calc.service';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ApiOkResponseData, ApiErrorResponse } from '../../common/response/response.decorator';
import { GLStartTaskDto } from '../gl-calc/dto/start-task.dto';
import { GLStartTaskResponseDto, GLStopTaskResponseDto, GLProgressResponseDto } from '../gl-calc/dto/response.dto';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { GLStopTaskDto } from '../gl-calc/dto/stop-task.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { GLPaginationDto } from '../gl-calc/dto/pagination.dto';
import { GLGetSchemeDto } from '../gl-calc/dto/get-scheme.dto';
import { ApiResponse } from '../../common/response/response.dto'

@ApiBearerAuth('JWT')
@ApiTags('铁前一体化配料计算任务接口')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('tqyth')
export class TqythCalcController {
  constructor(private readonly tqythCalcService: TqythCalcService) {}

  @Post('start')
  @Permissions('tqyth:calc')
  @ApiOperation({ summary: '启动铁前一体化配料计算任务', description: '计算类型填:铁前一体化配料计算I / 铁前一体化配料计算II' })
  @ApiOkResponseData(GLStartTaskResponseDto)
  @ApiErrorResponse()
  startTask(@CurrentUser() user: User, @Body() dto: GLStartTaskDto) {
    // 调整参数顺序，保证和 Service 一致
    return this.tqythCalcService.startTask(dto.calculateType, user);
  }

  @Post('stop')
  @Permissions('tqyth:calc')
  @ApiOperation({ summary: '停止铁前一体化配料计算I任务', description: '根据 task_id 停止正在运行的任务' })
  @ApiOkResponseData(GLStopTaskResponseDto)
  @ApiErrorResponse()
  stopTask(@Body() dto: GLStopTaskDto) {
    return this.tqythCalcService.stopTask(dto.task_id);
  }

  @Get('progress/:task_id')
  @Permissions('tqyth:calc')
  @ApiOperation({ summary: '查询铁前一体化计算任务进度' })
  @ApiParam({ name: 'task_id', description: '任务ID，由 /start 返回', required: true })
  @ApiOkResponseData(GLProgressResponseDto)
  @ApiErrorResponse()
  async getProgress(@Param('task_id') task_id: string, @Query() pagination: GLPaginationDto) {
    return this.tqythCalcService.fetchAndSaveProgress(task_id, pagination);
  }

  @Get('scheme')
@Permissions('tqyth:calc')
@ApiOperation({
  summary: '获取指定任务的某个方案信息',
  description: '根据 taskUuid 和方案序号 index 获取该方案的详细计算结果',
})
@ApiErrorResponse()
async getScheme(
  @Query() dto: GLGetSchemeDto,
  @CurrentUser() user: User,
): Promise<ApiResponse<any>> {
  // Service 已经返回 ApiResponse
  return await this.tqythCalcService.getSchemeByIndex(dto.taskUuid, dto.index);
}

}
