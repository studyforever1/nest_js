import { Controller, Post, Body, Get, Param,Query, UseGuards } from '@nestjs/common';
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
import { PaginationDto } from './dto/pagination.dto';
import { ExportSchemeDto } from './dto/export-scheme.dto';
import { Res } from '@nestjs/common';
import type { Response } from 'express';
import { GetSchemeDto } from './dto/get-scheme.dto';


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
    summary: '查询任务进度（分页 + 排序）',
    description: '查询增量结果，支持分页和排序',
  })
  @ApiParam({ name: 'task_id', description: '任务 ID，由 /start 返回', required: true })
  @ApiOkResponseData(ProgressResponseDto)
  @ApiErrorResponse()
  async getProgress(
    @Param('task_id') task_id: string,
    @Query() pagination: PaginationDto
  ) {
    return this.calcService.fetchAndSaveProgress(task_id, pagination);
  }
  @Post('export')
@Permissions('sj:calc')
@ApiOperation({
  summary: '导出选中的候选方案（Excel）',
  description: '根据方案序号导出方案，生成 xlsx 文件下载',
})
@ApiErrorResponse()
async exportTask(
  @Body() dto: ExportSchemeDto,
  @Res() res: Response,  // ✅ express Response
): Promise<void> {        // 返回 void
  try {
    const buffer = await this.calcService.exportSchemeExcel(dto);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=schemes_${dto.taskUuid}.xlsx`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer); // ✅ 手动结束
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}
  @Get('scheme')
@Permissions('sj:calc')
@ApiOperation({
  summary: '获取指定任务的某个方案信息',
  description: '根据 taskUuid 和方案序号 index 获取该方案的详细计算结果',
})
@ApiErrorResponse()
async getScheme(
  @Query() dto: GetSchemeDto,
  @CurrentUser() user: User,
): Promise<any> {
  const scheme = await this.calcService.getSchemeByIndex(dto.taskUuid, dto.index);
  if (!scheme) {
    return { code: 404, message: '方案不存在', data: null };
  }

  return { code: 0, message: '获取成功', data: scheme };
}
}
