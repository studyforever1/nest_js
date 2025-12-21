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
  @ApiOperation({ summary: '查询矿粉典型指标（分页+名称模糊）' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'name', required: false })
  findAll(@Query() pagination: PaginationDto, @Query('name') name?: string) {
    return this.service.query({ page: pagination.page ?? 1, pageSize: pagination.pageSize ?? 10, name });
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
  @ApiOperation({ summary: '导入矿粉典型指标 Excel' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  importExcel(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: { username: string }) {
    return this.service.importExcel(file, user.username);
  }
}
