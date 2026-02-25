import { Controller, Post, Body, Get, Param, Query, UseGuards,BadRequestException } from '@nestjs/common';
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
import * as XLSX from 'xlsx'; // ✅ TS 可识别类型声明

@ApiBearerAuth('JWT')
@ApiTags('单独高炉计算任务接口')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('gl')
export class GlCalcController {
  constructor(private readonly glCalcService: GlCalcService) {}

  @Post('start')
  @Permissions('gl:calc')
  @ApiOperation({ summary: '启动GL计算任务', description: '计算类型填：单独高炉配料计算' })
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


@Post('export/excel')
@Permissions('gl:calc')
@ApiOperation({
  summary: '导出高炉方案（Excel）',
  description: '根据 taskUuid 和方案序号导出 Excel 文件',
})
@ApiErrorResponse()
async exportExcel(
  @Body() dto: GLExportSchemeDto,
  @Res() res: Response,
): Promise<void> {
  try {
    // 1️⃣ 整理导出参数
    const { ingredientParams,fuelParams,otherSettings } =
      await this.glCalcService.exportSchemeExcel(dto.taskUuid, dto.index);

    // 2️⃣ 调用 FastAPI 生成 Excel
    const buffer = await this.glCalcService.callFastApi({
      ingredientParams,
      fuelParams,
      otherSettings,
    });

    // 3️⃣ 文件名
    const exportName =
      otherSettings?.['导出名称'] || `${dto.taskUuid}-${dto.index}`;
    const filename = encodeURIComponent(`${exportName}.xlsx`);

    // 4️⃣ 返回文件
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({
      code: 400,
      message: err.message || '导出失败',
    });
  }
}

@Post('preview/excel')
@Permissions('gl:calc')
@ApiOperation({
  summary: '预览高炉方案（Excel）',
  description: '根据 taskUuid 和方案序号返回 Excel 内容 JSON，用于前端预览。',
})
@ApiErrorResponse()
async previewExcel(
  @Body() dto: GLExportSchemeDto,
): Promise<{ sheetName: string; data: any[][] }> {
  try {
    // 1️⃣ 获取参数
    const { ingredientParams, fuelParams, otherSettings } =
      await this.glCalcService.exportSchemeExcel(dto.taskUuid, dto.index);

    // 2️⃣ 调用 FastAPI 生成 Excel buffer
    const buffer = await this.glCalcService.callFastApi({
      ingredientParams,
      fuelParams,
      otherSettings,
    });

    // 3️⃣ 使用 xlsx 库解析 Excel
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // 4️⃣ 取第一个 sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // 5️⃣ 转成 JSON 数组
    // 👇 关键修改：添加 defval: ""，将空单元格转为空字符串而不是 null
    const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      defval: "" 
    });

    // 6️⃣ 返回给前端
    return {
      sheetName: firstSheetName,
      data: jsonData,
    };
  } catch (err: any) {
    console.error(err);
    throw new BadRequestException(err.message || '预览失败');
  }
}



}
