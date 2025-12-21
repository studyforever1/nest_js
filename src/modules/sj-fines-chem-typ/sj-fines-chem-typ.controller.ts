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

import { SjFinesChemTypService } from './sj-fines-chem-typ.service';
import { CreateSjFinesChemTypDto } from './dto/create-sj-fines-chem-typ.dto';
import { UpdateSjFinesChemTypDto } from './dto/update-sj-fines-chem-typ.dto';
import { RemoveSjFinesChemTypDto } from './dto/remove-sj-fines-chem-typ.dto';
import { PaginationDto } from './dto/pagination.dto';

@ApiTags('烧结矿粉化学成分典型值数据库')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('sj-fines-chem-typ')
export class SjFinesChemTypController {
  constructor(private readonly service: SjFinesChemTypService) {}

  @Post()
  @ApiOperation({ summary: '新增烧结矿粉化学成分典型值' })
  create(@Body() dto: CreateSjFinesChemTypDto, @CurrentUser() user: { username: string }) {
    return this.service.create(dto, user.username);
  }

  @Get()
  @ApiOperation({ summary: '查询烧结矿粉化学成分典型值（分页+名称模糊）' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'name', required: false })
  findAll(@Query() pagination: PaginationDto, @Query('name') name?: string) {
    return this.service.query({ page: pagination.page ?? 1, pageSize: pagination.pageSize ?? 10, name });
  }

  @Put(':id')
  @ApiOperation({ summary: '更新烧结矿粉化学成分典型值' })
  update(@Param('id') id: string, @Body() dto: UpdateSjFinesChemTypDto, @CurrentUser() user: { username: string }) {
    return this.service.update(+id, dto, user.username);
  }

  @Delete()
  @ApiOperation({ summary: '删除烧结矿粉化学成分典型值（批量）' })
  remove(@Body() dto: RemoveSjFinesChemTypDto) {
    return this.service.remove(dto.ids);
  }

  @Delete('del_all')
  @ApiOperation({ summary: '清空烧结矿粉化学成分典型值数据库' })
  removeAll(@CurrentUser() user: { username: string }) {
    return this.service.removeAll(user.username);
  }

  @Get('export')
  @ApiOperation({ summary: '导出烧结矿粉化学成分典型值 Excel' })
  async export(@Res() res: Response) {
    const buffer = await this.service.exportExcel();
    res.setHeader('Content-Disposition', 'attachment; filename=sj_fines_chem_typ.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.end(buffer);
  }

  @Post('import')
  @ApiOperation({ summary: '导入烧结矿粉化学成分典型值 Excel' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  importExcel(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: { username: string }) {
    return this.service.importExcel(file, user.username);
  }
}
