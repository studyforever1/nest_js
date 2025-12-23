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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Response } from 'express';
import * as multer from 'multer';

import { PelletEconInfoService } from './pellet-econ-info.service';
import { CreatePelletEconInfoDto } from './dto/create-pellet-econ-info.dto';
import { UpdatePelletEconInfoDto } from './dto/update-pellet-econ-info.dto';
import { RemovePelletEconInfoDto } from './dto/remove-pellet-econ-info.dto';
import { PaginationDto } from './dto/pagination.dto';

@ApiTags('外购球团经济性评价-球团信息库')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('pellet-econ-info')
export class PelletEconInfoController {
  constructor(private readonly service: PelletEconInfoService) {}

  @Post()
  @ApiOperation({ summary: '新增球团经济性信息' })
  create(@Body() dto: CreatePelletEconInfoDto, @CurrentUser() user: { username: string }) {
    return this.service.create(dto, user.username);
  }

  @Get()
  @ApiOperation({ summary: '查询球团经济性信息（分页、名称模糊）' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'name', required: false })
  findAll(@Query() pagination: PaginationDto, @Query('name') name?: string) {
    return this.service.query({ page: pagination.page ?? 1, pageSize: pagination.pageSize ?? 10, name });
  }

  @Put(':id')
  @ApiOperation({ summary: '更新球团经济性信息' })
  update(@Param('id') id: string, @Body() dto: UpdatePelletEconInfoDto, @CurrentUser() user: { username: string }) {
    return this.service.update(+id, dto, user.username);
  }

  @Delete()
  @ApiOperation({ summary: '删除球团经济性信息（支持批量）' })
  remove(@Body() dto: RemovePelletEconInfoDto) {
    return this.service.remove(dto.ids);
  }

  @Delete('del_all')
  @ApiOperation({ summary: '清空球团经济性信息库' })
  removeAll(@CurrentUser() user: { username: string }) {
    return this.service.removeAll(user.username);
  }

  @Get('export')
  @ApiOperation({ summary: '导出球团经济性信息 Excel' })
  async export(@Res() res: Response) {
    const buffer = await this.service.exportExcel();
    res.setHeader('Content-Disposition', 'attachment; filename=pellet_econ_info.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.end(buffer);
  }

  @Post('import')
  @ApiOperation({ summary: '导入球团经济性信息 Excel' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  importExcel(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: { username: string }) {
    return this.service.importExcel(file, user.username);
  }
}
