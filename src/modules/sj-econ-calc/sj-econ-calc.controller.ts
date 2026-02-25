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
import { TaskProgressQueryDto  } from './dto/sj-econ-pagination.dto';
import {EconSummaryDto } from './dto/econ-summary.dto';
import type { Response } from 'express'; // 注意加 type
import { Res } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { EconDataSourceType } from './enums/econ-data-source-type.enum';

@ApiBearerAuth('JWT')
@ApiTags('烧结原料经济性评价-计算')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('sj/econ')
export class SjEconCalcController {
  constructor(private readonly econService: SjEconCalcService) {}

/**
 * @api {post} /econ-calc/start 启动经济性综合评价（四任务并行）
 * @apiName StartEconCalc
 * @apiGroup EconCalc
 * 
 * @apiDescription
 * 启动经济性综合评价任务，内部同时并行执行四种评价方法：
 * 1. 品位综合评价法
 * 2. 单烧综合评价法
 * 3. 铁水成本评价法
 * 4. 基准矿粉对比评价法
 *
 * 根据 `dataSourceType` 决定原料数据来源：
 * - `ECON`：使用烧结经济性信息库的历史原料参数
 * - `SJ_RAW`：使用烧结物料信息库（分类编号以 T 开头的物料）
 * - `PORT_IRON`：使用港口矿粉资源库
 *
 * 前端只需调用此接口并传入模块名和数据来源类型即可启动四个任务。
 * 
 * @param {User} user 当前登录用户，通过 @CurrentUser 装饰器注入
 * @param {StartEconCalcDto} dto 请求参数，包括模块名和数据来源类型
 *
 * @returns {Promise<ApiResponse<{ tasks: { taskUuid: string; name: string }[]; status: string }>>}
 * 返回四个任务的 UUID 和名称，以及整体任务状态 `RUNNING`
 */
@Post('start')
@Permissions('sj:calc')
@ApiOperation({ summary: '启动经济性综合评价（四评价法并行）' ,
  description:'`ECON`：使用烧结经济性信息库的历史原料参数,`SJ_RAW`：使用烧结物料信息库（分类编号以 T 开头的物料）,`PORT_IRON`：使用港口矿粉资源库'
})
async start(
  @CurrentUser() user: User,
  @Body() dto: StartEconCalcDto
) {
  return this.econService.startEconCalc(user, dto.calculateType, dto.dataSourceType);
}


  /** 停止四个任务 */
  @Post('stop')
  @Permissions('sj:calc')
  @ApiOperation({ summary: '停止经济性综合评价（四任务全部停止）' })
  async stop(@Body() dto: StopEconCalcDto) {
    return this.econService.stopTasks(dto.taskUuids);
  }
/**
 * 查询单个经济性任务进度（分页 + 排序）
 *
 * 支持三种数据来源：
 * - ECON：烧结经济性信息库（原始评价任务）
 * - SJ_RAW：烧结物料信息库评价任务
 * - PORT_IRON：港口矿粉资源库评价任务
 *
 * 性价比排名规则：
 * - 品位综合评价法：单品位价格折算后（asc）
 * - 单烧综合评价法：烧结矿单品位价折算后（asc）
 * - 铁水成本评价法：生铁成本（asc）
 * - 基准矿粉对比评价法：与PB粉对比（asc）
 *
 * @param task_id 任务 UUID
 * @param pagination 分页参数
 * @param dataSourceType 数据来源类型，ECON | SJ_RAW | PORT_IRON
 */
@Get('progress/:task_id')
@Permissions('sj:calc')
@ApiOperation({ summary: '查询单个经济性任务进度，支持分页和排序' })
async getTaskProgress(
  @Param('task_id') task_id: string,
  @Query() query: TaskProgressQueryDto
) {
  // query.dataSourceType, query.page, query.pageSize, query.sort, query.order 都可以直接用
  return this.econService.fetchEconProgress(
    task_id,
    query.dataSourceType,
    query
  );
}


@Get('export/:task_id')
@Permissions('sj:calc')
@ApiOperation({ summary: '导出经济性任务结果为Excel' })
async exportTaskResult(
  @Param('task_id') task_id: string,
  @Query() query: TaskProgressQueryDto,
  @Res() res: Response,
) {
  return this.econService.exportEconResult(task_id, query.dataSourceType, query, res);
}


@Post('summary')
@Permissions('sj:calc')
@ApiOperation({ summary: '经济性评价结果汇总（四评价法）' })
async getSummary(@Body() dto: EconSummaryDto) {
  return this.econService.buildSummaryFromTaskRefs(dto.taskUuids, dto);
}

   @Post('summary/export')
@Permissions('sj:calc')
@ApiOperation({
  summary: '导出经济性评价汇总到 Excel',
  description: '`dataSourceType` 决定数据来源：ECON、SJ_RAW、PORT_IRON',
})
async exportSummaryExcel(
  @Body() dto: EconSummaryDto,
  @Res() res: Response,
) {
  try {
    // 1️⃣ 调用统一 Service 方法
    const summaryResp = await this.econService.buildSummaryFromTaskRefs(dto.taskUuids, dto);

    if (summaryResp.code !== 0) {
      return res.status(400).json(summaryResp);
    }

    const summaryData: Record<string, any>[] = summaryResp.data?.results || [];
    if (!summaryData.length) {
      return res.status(400).json({ code: 400, message: '没有可导出的数据' });
    }

    // 2️⃣ 设置 Excel sheet 名称和文件名
    const sheetNameMap = {
      ECON: '经济性评价汇总',
      SJ_RAW: '烧结物料信息库评价汇总',
      PORT_IRON: '港口矿粉资源库评价汇总',
    };
    const fileNameMap = {
      ECON: '经济性评价汇总.xlsx',
      SJ_RAW: '烧结物料信息库评价汇总.xlsx',
      PORT_IRON: '港口矿粉资源库评价汇总.xlsx',
    };
    const sheetName = sheetNameMap[dto.dataSourceType];
    const fileName = fileNameMap[dto.dataSourceType];

    // 3️⃣ 创建 Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.columns = Object.keys(summaryData[0]).map(key => ({
      header: key,
      key,
      width: 20,
    }));

    summaryData.forEach(item => worksheet.addRow(item));

    // 4️⃣ 返回文件
    const buffer = await workbook.xlsx.writeBuffer();
    const encodedFileName = encodeURIComponent(fileName);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodedFileName}"`);
    res.setHeader('Content-Length', buffer.byteLength);
    res.end(buffer);

  } catch (err: any) {
    console.error(err);
    res.status(400).json({ code: 400, message: err.message || '导出失败' });
  }
}
}
