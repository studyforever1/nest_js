import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Delete,
  Param,
  Query,
  Res,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response, Express } from 'express';
import * as multer from 'multer';

import { PortPelletLumpInfoService } from './port-pellet-lump-info.service';
import { CreatePortPelletLumpInfoDto } from './dto/create-port-pellet-lump-info.dto';
import { UpdatePortPelletLumpInfoDto } from './dto/update-port-pellet-lump-info.dto';
import { RemovePortPelletLumpInfoDto } from './dto/remove-port-pellet-lump-info.dto';
import { PortPelletLumpPaginationDto } from './dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';


@ApiTags('港口资源-球团块矿')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
@Controller('port/pellet-lump-info')
export class PortPelletLumpInfoController {
  constructor(
    private readonly service: PortPelletLumpInfoService,
  ) {}

  @Post()
  @ApiOperation({ summary: '新增球团/块矿信息' })
  create(
    @Body() dto: CreatePortPelletLumpInfoDto,
    @CurrentUser() user: { username: string },
  ) {
    return this.service.create(dto, user.username);
  }

  @Get()
  @ApiOperation({ summary: '查询球团/块矿信息（支持分页、名称模糊、类型筛选）' })
  findAll(@Query() query: PortPelletLumpPaginationDto) {
    return this.service.query(query);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新球团/块矿信息' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePortPelletLumpInfoDto,
    @CurrentUser() user: { username: string },
  ) {
    return this.service.update(+id, dto, user.username);
  }

  @Delete()
  @ApiOperation({ summary: '删除球团/块矿信息' })
  remove(@Body() dto: RemovePortPelletLumpInfoDto) {
    return this.service.remove(dto.ids);
  }

  @Get('export')
  @ApiOperation({ summary: '导出 Excel' })
  async export(@Res() res: Response) {
    const buffer = await this.service.exportExcel();
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=port_pellet_lump_info.xlsx',
    );
    res.end(buffer);
  }

  @Post('import')
  @ApiOperation({ summary: '导入 Excel（新增数据）' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  importExcel(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { username: string },
  ) {
    // 表头校验 + 缺失字段补0等逻辑在 service 内统一处理
    return this.service.importExcel(file, user.username);
  }

  @Post('import-batch-update')
  @ApiOperation({ summary: '导入 Excel（按物料名称批量修改）' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  importExcelBatchUpdate(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { username: string },
  ) {
    return this.service.importExcelBatchUpdate(file, user.username);
  }

  @Get('template')
  @ApiOperation({ summary: '下载导入模板（按 FIXED_HEADERS 表头顺序）' })
  async downloadTemplate(@Res() res: Response) {
    // 模板文件路径由 service 负责确保存在（不存在会自动生成）
    const filePath = await this.service.getTemplateFilePath();
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=port_pellet_lump_template.xlsx',
    );
    res.sendFile(filePath, { root: process.cwd() });
  }

  @Get('template-batch-update')
  @ApiOperation({ summary: '下载批量修改导入模板（按物料名称更新已有数据）' })
  async downloadBatchUpdateTemplate(@Res() res: Response) {
    const filePath = await this.service.getBatchUpdateTemplateFilePath();
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=port_pellet_lump_info_batch_update_template.xlsx',
    );
    res.sendFile(filePath, { root: process.cwd() });
  }

  /** 删除所有原料 */
@Delete('del_all')
@ApiOperation({ summary: '删除原料库所有原料' })
async removeAll(@CurrentUser() user: { username: string }) {
  try {
    return await this.service.removeAll(user.username);
  } catch (error) {
    console.error('删除所有原料失败:', error);
    return { status: 'error', message: '删除失败' };
  }
}

}
