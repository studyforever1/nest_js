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

@ApiTags('块矿-冶金性能数据库')
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
  @ApiOperation({ summary: '查询块矿冶金性能（分页、名称模糊）' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'name', required: false })
  findAll(@Query() pagination: PaginationDto, @Query('name') name?: string) {
    return this.service.query({ page: pagination.page ?? 1, pageSize: pagination.pageSize ?? 10, name });
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
}
