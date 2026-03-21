import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  UseGuards,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBody,
  ApiConsumes,
  ApiBearerAuth,
  ApiOperation
} from '@nestjs/swagger';

import { CommonService } from './common.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';

import { ImportConfigDto } from './dto/import-config.dto';
import { ExportConfigDto } from './dto/export-config.dto';
import { ModuleName } from 'src/common/enums/module-type.enum';

import type { Response } from 'express';

export const ModuleNameOrder = [
  ModuleName.SJ_BL,
  ModuleName.BF_BL,
  ModuleName.IRON_I,
  ModuleName.IRON_II,
  ModuleName.PROFIT,
  ModuleName.SJ_ECON,
  ModuleName.COKE_ECON,
  ModuleName.PELLET_ECON,
  ModuleName.LUMP_ECON,
  ModuleName.PCI_ECON,
  ModuleName.MIX_COAL,
  ModuleName.COST_PROFIT,
  ModuleName.SJ_FIXED,
  ModuleName.S_BALANCE,
  ModuleName.PIG_FIXED,
];

@ApiTags('配置管理（导入 / 导出 / 模块管理）')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('common/config')
export class CommonController {
  constructor(private readonly commonService: CommonService) {}

  /**
   * 📋 模块下拉
   */
  @Post('module-enum')
  @ApiOperation({
    summary: '获取模块列表（下拉框）',
    description: '返回所有模块名称，用于前端选择',
  })
  getModuleEnum() {
    return ModuleNameOrder.map((value) => ({
      label: value,
      value,
    }));
  }

  /**
   * 📤 导出配置
   */
  @Post('export')
  @ApiOperation({
    summary: '导出模块配置',
    description: '根据模块名称导出配置（返回加密 .wz 文件）',
  })
  @ApiBody({ type: ExportConfigDto })
  async export(
    @Body() body: ExportConfigDto,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const result = await this.commonService.exportConfig(
      body.moduleName,
      user,
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${encodeURIComponent(result.fileName)}`,
    );

    res.setHeader('Content-Type', 'application/octet-stream');

    res.send(result.content);
  }

  /**
   * 📥 导入配置
   */
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: '导入模块配置',
    description: '上传 .wz 文件并导入对应模块配置',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: ImportConfigDto,
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '上传 .wz 文件',
        },
        moduleName: {
          type: 'string',
          enum: Object.values(ModuleName),
          description: '模块名称',
        },
      },
      required: ['file', 'moduleName'],
    },
  })
  async import(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: ImportConfigDto,
    @CurrentUser() user: User,
  ) {
    return this.commonService.importConfig(
      file,
      body.moduleName,
      user,
    );
  }
}