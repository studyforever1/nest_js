import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UploadedFile,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { SjRawMaterialService } from './sj-raw-material.service';
import { CreateSjRawMaterialDto } from './dto/create-sj-raw-material.dto';
import { UpdateSjRawMaterialDto } from './dto/update-sj-raw-material.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

@ApiTags('烧结原料库')
@Controller('sj-raw-material')
export class SjRawMaterialController {
  constructor(private readonly rawService: SjRawMaterialService) {}

  @Post()
  @ApiOperation({ summary: '新增原料' })
  create(@Body() dto: CreateSjRawMaterialDto) {
    return this.rawService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '查询所有原料' })
  findAll() {
    return this.rawService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '按ID查询原料' })
  findOne(@Param('id') id: string) {
    return this.rawService.findOne(+id);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新原料' })
  update(@Param('id') id: string, @Body() dto: UpdateSjRawMaterialDto) {
    return this.rawService.update(+id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除原料' })
  remove(@Param('id') id: string) {
    return this.rawService.remove(+id);
  }

  /** ========== 导出 Excel ========== */
  @Get('export')
  @ApiOperation({ summary: '导出原料数据为 Excel' })
  async export(@Res() res: Response) {
    const buffer = await this.rawService.exportExcel();
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=sj_raw_material.xlsx',
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.end(buffer);
  }
}
