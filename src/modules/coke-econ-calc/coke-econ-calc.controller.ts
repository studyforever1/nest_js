import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { CokeEconCalcService } from './coke-econ-calc.service';

import { CokeStartEconCalcDto } from './dto/start-coke-econ-calc.dto';
import { CokeStopEconCalcDto } from './dto/stop-coke-econ-calc.dto';
import { CokeEconPaginationDto} from './dto/coke-econ-pagination.dto';
import { EconSummaryDto } from './dto/econ-summary.dto';

import type { Response } from 'express';
import * as ExcelJS from 'exceljs';

@ApiBearerAuth('JWT')
@ApiTags('焦炭经济性评价-计算')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('coke-econ-calc')
export class CokeEconCalcController {
  constructor(private readonly cokeService: CokeEconCalcService) {}

  /** 启动任务 */
  @Post('start')
  @Permissions('coke:calc')
  @ApiOperation({ summary: '启动焦炭经济性评价任务（多任务并行）' })
  async start(
    @CurrentUser() user: User,
    @Body() dto: CokeStartEconCalcDto,
  ) {
    return this.cokeService.startTasks(user, dto.calculateType);
  }

  /** 停止任务 */
  @Post('stop')
  @Permissions('coke:calc')
  @ApiOperation({ summary: '停止焦炭经济性评价任务' })
  async stop(@Body() dto: CokeStopEconCalcDto) {
    return this.cokeService.stopTasks(dto.taskUuids);
  }

  /** 查询单个任务进度 */
  @Get('progress/:task_id')
  @Permissions('coke:calc')
  @ApiOperation({
    summary:
      '查询单个任务进度（支持分页）— 性价比法按性价比指数 desc，综合评价法按质量评分 desc',
  })
  async getTaskProgress(
    @Param('task_id') taskId: string,
    @Query() pagination: CokeEconPaginationDto,
  ) {
    return this.cokeService.fetchAndSaveProgress(taskId, pagination);
  }

  /** 结果汇总 */
  @Post('summary')
  @Permissions('coke:calc')
  @ApiOperation({ summary: '焦炭经济性评价结果汇总' })
  async getSummary(@Body() dto: EconSummaryDto) {
    return this.cokeService.buildSummaryFromTaskRefs(
      dto.taskUuids,
      dto, // 预留分页/排序
    );
  }

  /** 导出汇总结果 */
  @Post('summary/export')
  @Permissions('coke:calc')
  @ApiOperation({ summary: '导出焦炭经济性评价汇总到 Excel' })
  async exportSummaryExcel(
    @Body() dto: EconSummaryDto,
    @Res() res: Response,
  ) {
    try {
      const summaryResp =
        await this.cokeService.buildSummaryFromTaskRefs(
          dto.taskUuids,
          dto,
        );

      if (summaryResp.code !== 0) {
        return res.status(400).json(summaryResp);
      }

      const summaryData: Record<string, any>[] =
        summaryResp.data?.results || [];

      if (!Array.isArray(summaryData) || summaryData.length === 0) {
        return res
          .status(400)
          .json({ code: 400, message: '没有可导出的数据' });
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('焦炭经济性评价汇总');

      worksheet.columns = Object.keys(summaryData[0]).map(key => ({
        header: key,
        key,
        width: 20,
      }));

      summaryData.forEach(row => worksheet.addRow(row));

      const buffer = await workbook.xlsx.writeBuffer();
      const filename = encodeURIComponent('焦炭经济性评价汇总.xlsx');

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.setHeader('Content-Length', buffer.byteLength);
      res.end(buffer);
    } catch (err: any) {
      console.error(err);
      res
        .status(400)
        .json({ code: 400, message: err.message || '导出失败' });
    }
  }
}
