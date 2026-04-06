import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Res,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Response } from 'express';
import * as multer from 'multer';

import { MineTypIndService } from './mine-typ-ind.service';
import { CreateMineTypIndDto } from './dto/create-mine-typ-ind.dto';
import { UpdateMineTypIndDto } from './dto/update-mine-typ-ind.dto';
import { RemoveMineTypIndDto } from './dto/remove-mine-typ-ind.dto';
import { PaginationDto } from './dto/pagination.dto';


@ApiTags('主要矿粉典型指标数据库')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('mine-typ-ind')
export class MineTypIndController {
  constructor(private readonly service: MineTypIndService) {}

  @Post()
  @ApiOperation({ summary: '新增矿粉典型指标' })
  create(@Body() dto: CreateMineTypIndDto, @CurrentUser() user: { username: string }) {
    return this.service.create(dto, user.username);
  }

  @Get()
  @ApiOperation({ summary: '查询矿粉典型指标（支持分页、名称模糊、排序）' })
  @ApiQuery({ name: 'page', required: false, description: '页码（默认1）' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页条数（默认10）' })
  @ApiQuery({ name: 'name', required: false, description: '名称模糊查询' })
  @ApiQuery({ name: 'sort', required: false, description: '排序字段，如 name、created_at、composition.TFe' })
  @ApiQuery({ name: 'order', required: false, description: 'asc / desc' })
  findAll(@Query() pagination: PaginationDto) {
    return this.service.query(pagination);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新矿粉典型指标' })
  update(@Param('id') id: string, @Body() dto: UpdateMineTypIndDto, @CurrentUser() user: { username: string }) {
    return this.service.update(+id, dto, user.username);
  }

  @Delete()
  @ApiOperation({ summary: '删除矿粉典型指标（批量）' })
  remove(@Body() dto: RemoveMineTypIndDto) {
    return this.service.remove(dto.ids);
  }

  @Delete('del_all')
  @ApiOperation({ summary: '清空矿粉典型指标数据库' })
  removeAll(@CurrentUser() user: { username: string }) {
    return this.service.removeAll(user.username);
  }

  @Get('export')
  @ApiOperation({ summary: '导出矿粉典型指标 Excel' })
  async export(@Res() res: Response) {
    const buffer = await this.service.exportExcel();
    res.setHeader('Content-Disposition', 'attachment; filename=mine_typ_ind.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.end(buffer);
  }

  @Post('import')
  @ApiOperation({ summary: '导入矿粉典型指标 Excel（新增数据）' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  importExcel(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: { username: string }) {
    return this.service.importExcel(file, user.username);
  }

  @Post('import-batch-update')
  @ApiOperation({ summary: '导入矿粉典型指标 Excel（按物料名称批量修改）' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  importExcelBatchUpdate(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: { username: string }) {
    return this.service.importExcelBatchUpdate(file, user.username);
  }

  @Get('template')
  @ApiOperation({ summary: '下载导入模板（按 FIXED_HEADERS 表头顺序）' })
  async downloadTemplate(@Res() res: Response) {
    const filePath = await this.service.getTemplateFilePath();
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=mine_typ_ind_template.xlsx',
    );
    res.sendFile(filePath, { root: process.cwd() });
  }

  @Get('template-batch-update')
  @ApiOperation({ summary: '下载批量修改导入模板（按物料名称更新已有数据）' })
  async downloadBatchUpdateTemplate(@Res() res: Response) {
    const filePath = await this.service.getBatchUpdateTemplateFilePath();
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=mine_typ_ind_batch_update_template.xlsx',
    );
    res.sendFile(filePath, { root: process.cwd() });
  }
}
