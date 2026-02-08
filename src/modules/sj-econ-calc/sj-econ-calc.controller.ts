import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { SjEconCalcService } from './sj-econ-calc.service';
import { StartEconCalcDto } from './dto/start-econ-calc.dto';
import { StopEconCalcDto } from './dto/stop-econ-calc.dto';
import { Param } from '@nestjs/common';
import { SJEconPaginationDto } from './dto/sj-econ-pagination.dto';
import {EconSummaryDto } from './dto/econ-summary.dto';
import type { Response } from 'express'; // 注意加 type
import { Res } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

@ApiBearerAuth('JWT')
@ApiTags('烧结原料经济性评价-计算')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('sj/econ')
export class SjEconCalcController {
  constructor(private readonly econService: SjEconCalcService) {}

  /** 启动经济性综合评价（四任务并行） */
  @Post('start')
  @Permissions('sj:calc')
  @ApiOperation({ summary: '启动经济性综合评价（四评价法并行）' })
  async start(
    @CurrentUser() user: User,
    @Body() dto: StartEconCalcDto
  ) {
    return this.econService.startTasks(user, dto.calculateType);
  }

@Post('material-library/start')
@Permissions('sj:calc')
@ApiOperation({ summary: '启动烧结物料信息库评价' })
async startMaterialLibraryCalc(
  @CurrentUser() user: User,
  @Body() dto: StartEconCalcDto,
) {
  return this.econService.startMaterialLibraryTasks(
    user,
    dto.calculateType,
  );
}

@Post('port-iron-ore/start')
@Permissions('sj:calc')
@ApiOperation({ summary: '启动港口矿粉资源库评价' })
async startPortIronOreCalc(
  @CurrentUser() user: User,
  @Body() dto: StartEconCalcDto,
) {
  return this.econService.startPortIronOreTasks(
    user,
    dto.calculateType,
  );
}

  /** 停止四个任务 */
  @Post('stop')
  @Permissions('sj:calc')
  @ApiOperation({ summary: '停止经济性综合评价（四任务全部停止）' })
  async stop(@Body() dto: StopEconCalcDto) {
    return this.econService.stopTasks(dto.taskUuids);
  }

  /** 查询单个任务进度（分页 + 排序） */
  @Get('progress/:task_id')
  @Permissions('sj:calc')
  @ApiOperation({ summary: '查询单个任务进度，支持分页和排序, 品位综合评价法按照单品位价格折算后(asc)排序,\
    单烧综合评价法按照烧结矿单品位价折算后(asc),铁水成本评价法按照生铁成本(asc),基准矿粉对比评价法按照与PB粉对比(asc)' })
  async getTaskProgress(
    @Param('task_id') task_id: string,
    @Query() pagination: SJEconPaginationDto
  ) {
    return this.econService.fetchAndSaveProgress(task_id, pagination);
  }

  /** 查询烧结物料信息库评价任务进度（分页 + 排序） */
@Get('material-library/progress/:task_id')
@Permissions('sj:calc')
@ApiOperation({
  summary: '查询烧结物料信息库评价任务进度，支持分页和排序',
})
async getMaterialLibraryTaskProgress(
  @Param('task_id') task_id: string,
  @Query() pagination: SJEconPaginationDto,
) {
  return this.econService.fetchMaterialLibraryProgress(task_id, pagination);
}

@Get('port-iron-ore/progress/:task_id')
@Permissions('sj:calc')
@ApiOperation({ summary: '查询港口矿粉资源库评价任务进度' })
async getPortIronOreTaskProgress(
  @Param('task_id') task_id: string,
  @Query() pagination: SJEconPaginationDto,
) {
  return this.econService.fetchPortIronOreProgress(task_id, pagination);
}


@Post('summary')
@Permissions('sj:calc')
@ApiOperation({ summary: '四种经济性评价结果汇总' })
async getSummary(@Body() dto: EconSummaryDto) {
  return this.econService.buildSummaryFromTaskRefs(dto.taskUuids, dto);
}
@Post('summary/material-library')
async summaryMaterial(@Body() dto: EconSummaryDto) {
  return this.econService.buildMaterialLibrarySummaryFromTaskRefs(
    dto.taskUuids,
    dto,
  );
}

@Post('summary/port-iron-ore')
async summaryPort(@Body() dto: EconSummaryDto) {
  return this.econService.buildPortIronOreSummaryFromTaskRefs(
    dto.taskUuids,
    dto,
  );
}

   
@Post('summary/export')
@Permissions('sj:calc')
@ApiOperation({ summary: '导出四种经济性评价汇总到 Excel' })
async exportSummaryExcel(
  @Body() dto: EconSummaryDto,
  @Res() res: Response,
) {
  try {
    const summaryResp = await this.econService.buildSummaryFromTaskRefs(dto.taskUuids);
    if (summaryResp.code !== 0) {
      return res.status(400).json(summaryResp);
    }

    // ✅ 取真正的数组
    let summaryData: Record<string, any>[] = summaryResp.data?.results || [];

    if (!Array.isArray(summaryData) || summaryData.length === 0) {
      return res.status(400).json({ code: 400, message: '没有可导出的数据' });
    }

    // Excel 创建
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('经济性评价汇总');

    // 表头
    worksheet.columns = Object.keys(summaryData[0]).map(key => ({ header: key, key, width: 20 }));

    // 填充数据
    summaryData.forEach(item => worksheet.addRow(item));

    // 返回文件
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = encodeURIComponent('经济性评价汇总.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.byteLength);
    res.end(buffer);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ code: 400, message: err.message || '导出失败' });
  }
}

}
