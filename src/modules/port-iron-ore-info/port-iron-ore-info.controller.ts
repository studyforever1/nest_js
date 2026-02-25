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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';

import { PortIronOreInfoService } from './port-iron-ore-info.service';
import { CreatePortIronOreInfoDto } from './dto/create-port-iron-ore-info.dto';
import { UpdatePortIronOreInfoDto } from './dto/update-port-iron-ore-info.dto';
import { RemovePortIronOreInfoDto } from './dto/remove-port-iron-ore-info.dto';
import { PortIronOrePaginationDto } from './dto/pagination.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiBody } from '@nestjs/swagger';
import * as multer from 'multer';



@ApiTags('港口资源-矿粉信息')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
@Controller('port/iron-ore-info')
export class PortIronOreInfoController {
    constructor(private readonly service: PortIronOreInfoService) { }

    @Post()
    @ApiOperation({ summary: '新增港口矿粉' })
    create(@Body() dto: CreatePortIronOreInfoDto, @CurrentUser() user) {
        return this.service.create(dto, user.username);
    }

    @Get()
    @ApiOperation({ summary: '查询港口矿粉（支持分页、名称模糊、类型筛选、排序）' })
    findAll(@Query() query: PortIronOrePaginationDto) {
        return this.service.query(query);
    }

    @Put(':id')
    @ApiOperation({ summary: '更新港口矿粉' })
    update(
        @Param('id') id: string,
        @Body() dto: UpdatePortIronOreInfoDto,
        @CurrentUser() user,
    ) {
        return this.service.update(+id, dto, user.username);
    }

    @Delete()
    @ApiOperation({ summary: '删除港口矿粉' })
    remove(@Body() dto: RemovePortIronOreInfoDto) {
        return this.service.remove(dto.ids);
    }

    @Get('export')
    @ApiOperation({ summary: '导出 Excel' })
    async export(@Res() res: Response) {
        const buffer = await this.service.exportExcel();
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=port_iron_ore_info.xlsx',
        );
        res.end(buffer);
    }

    @Post('import')
@ApiOperation({ summary: '导入港口矿粉 Excel 文件' })
@ApiConsumes('multipart/form-data')
@UseInterceptors(
  FileInterceptor('file', {
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  }),
)
@ApiBody({
  description: '上传 Excel 文件',
  required: true,
  schema: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'binary' },
    },
  },
})
async importExcel(
  @UploadedFile() file: Express.Multer.File,
  @CurrentUser() user: { username: string },
) {
  if (!file || !file.buffer) {
    return { status: 'error', message: '请上传文件或文件为空' };
  }

  return this.service.importExcel(file, user.username);
}

  @Get('template')
  @ApiOperation({ summary: '下载导入模板（按 FIXED_HEADERS 表头顺序）' })
  async downloadTemplate(@Res() res: Response) {
    const filePath = await this.service.getTemplateFilePath();
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=port_iron_ore_info_template.xlsx',
    );
    res.sendFile(filePath, { root: process.cwd() });
  }

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
