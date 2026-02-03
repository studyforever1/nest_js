import { Controller, Get, Post, Body, Param, Delete, Put, Res, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Response } from 'express';
import * as multer from 'multer';

import { LumpMetallurgyPropService } from './lump-metallurgy-prop.service';
import { CreateLumpMetallurgyPropDto } from './dto/create-lump-metallurgy-prop.dto';
import { UpdateLumpMetallurgyPropDto } from './dto/update-lump-metallurgy-prop.dto';
import { RemoveLumpMetallurgyPropDto } from './dto/remove-lump-metallurgy-prop.dto';
import { PaginationDto } from './dto/pagination.dto';

@ApiTags('块矿冶金性能数据库')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('lump-metallurgy-prop')
export class LumpMetallurgyPropController {
  constructor(private readonly service: LumpMetallurgyPropService) {}

  @Post()
  @ApiOperation({ summary: '新增块矿冶金性能' })
  create(@Body() dto: CreateLumpMetallurgyPropDto, @CurrentUser() user: { username: string }) {
    return this.service.create(dto, user.username);
  }

  @Get()
  @ApiOperation({ summary: '查询块矿冶金性能（支持分页、名称模糊、类型筛选、排序）' })
  @ApiQuery({ name: 'page', required: false, description: '页码（默认1）' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页条数（默认10）' })
  @ApiQuery({ name: 'name', required: false, description: '名称模糊查询' })
  @ApiQuery({ name: 'type', required: false, description: '类型筛选' })
  @ApiQuery({ name: 'sort', required: false, description: '排序字段，如 name、created_at、properties.TFe' })
  @ApiQuery({ name: 'order', required: false, description: 'asc / desc' })
  findAll(@Query() pagination: PaginationDto) {
    return this.service.query(pagination);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新块矿冶金性能' })
  update(@Param('id') id: string, @Body() dto: UpdateLumpMetallurgyPropDto, @CurrentUser() user: { username: string }) {
    return this.service.update(+id, dto, user.username);
  }

  @Delete()
  @ApiOperation({ summary: '删除块矿冶金性能（批量）' })
  remove(@Body() dto: RemoveLumpMetallurgyPropDto) {
    return this.service.remove(dto.ids);
  }

  @Delete('del_all')
  @ApiOperation({ summary: '清空块矿冶金性能数据库' })
  removeAll(@CurrentUser() user: { username: string }) {
    return this.service.removeAll(user.username);
  }

  @Get('export')
  @ApiOperation({ summary: '导出块矿冶金性能 Excel' })
  async export(@Res() res: Response) {
    const buffer = await this.service.exportExcel();
    res.setHeader('Content-Disposition', 'attachment; filename=lump_metallurgy_prop.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.end(buffer);
  }

  @Post('import')
  @ApiOperation({ summary: '导入块矿冶金性能 Excel' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  importExcel(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: { username: string }) {
    return this.service.importExcel(file, user.username);
  }

  @Get('template')
  @ApiOperation({ summary: '下载导入模板（按 FIXED_HEADERS 表头顺序）' })
  async downloadTemplate(@Res() res: Response) {
    const filePath = await this.service.getTemplateFilePath();
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=lump_metallurgy_prop_template.xlsx',
    );
    res.sendFile(filePath, { root: process.cwd() });
  }
}
