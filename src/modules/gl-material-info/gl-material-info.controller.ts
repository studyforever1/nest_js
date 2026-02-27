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
import { GlMaterialInfoService } from './gl-material-info.service';
import { CreateGlMaterialInfoDto } from './dto/create-gl-material-info.dto';
import { UpdateGlMaterialInfoDto } from './dto/update-gl-material-info.dto';
import { RemoveGlMaterialInfoDto } from './dto/remove-gl-material-info.dto';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Response } from 'express';
import * as multer from 'multer';
import { GLPaginationDto } from './dto/pagination.dto';
import { User } from '../user/entities/user.entity';
import { ApiResponse } from 'src/common/response/response.dto';



export enum Category {
  烧结矿 = 'S',
  球团矿 = 'Q',
  块矿 = 'K',
}

export enum Origin {
  国内精矿 = '国内精矿',
  外精矿 = '外精矿',
  澳矿 = '澳矿',
  巴西矿 = '巴西矿',
  印度矿 = '印度矿',
  其他粉矿 = '其他粉矿',

}



@ApiTags('物料信息-高炉物料信息')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('gl-material-info')
export class GlMaterialInfoController {
  constructor(private readonly rawService: GlMaterialInfoService) {}

@Get('categories')
async getCategories(): Promise<ApiResponse<any>> {
  const options = Object.entries(Category).map(([label, value]) => ({
    label,   // 中文名称
    value,   // 实际存库值
  }));
  return ApiResponse.success(options);
}

@Get('origins')
async getOrigins(): Promise<ApiResponse<any>> {
  const options = Object.values(Origin).map(value => ({
    label: value, // 前端显示
    value,        // 前端选中填入表单
  }));
  return ApiResponse.success(options);
}

  /** 新增原料 */
  @Post()
  @ApiOperation({
    summary: '添加按钮',
    description: '在高炉物料信息库中添加新的物料',
  })
  create(
    @Body() dto: CreateGlMaterialInfoDto,
    @CurrentUser() user: { username: string },
  ) {
    return this.rawService.create(dto, user.username);
  }

  /**
   * 查询（统一接口）
   * 支持：分页 / 名称模糊 / 类型筛选 / 排序
   */
@Get()
@ApiOperation({
  summary: '查询原料（支持分页、名称模糊、类型筛选、排序）',
})
async findAll(
  @CurrentUser() user: User,
  @Query() query: GLPaginationDto,
) {
  return this.rawService.query(user, query);
}

  /** 更新原料 */
  @Put(':id')
  @ApiOperation({ summary: '保存按钮' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGlMaterialInfoDto,
    @CurrentUser() user: { username: string },
  ) {
    return this.rawService.update(+id, dto, user.username);
  }

  /** 删除原料（支持单个或多个） */
  @Delete()
  @ApiOperation({ summary: '删除原料（支持单个或多个）' })
  remove(@Body() dto: RemoveGlMaterialInfoDto) {
    return this.rawService.remove(dto.ids);
  }

  /** 导出 Excel */
  @Get('export')
  @ApiOperation({ summary: '导出原料数据为 Excel' })
  async export(@Res() res: Response) {
    const buffer = await this.rawService.exportExcel();
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=gl_material_info.xlsx',
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.end(buffer);
  }

  /** 导入 Excel */
  @Post('import')
  @ApiOperation({ summary: '导入原料 Excel 文件' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { storage: multer.memoryStorage() }),
  )
  @ApiBody({
    description: '上传 Excel 文件',
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
    if (!file?.buffer) {
      return { status: 'error', message: '请上传文件或文件为空' };
    }
    return this.rawService.importExcel(file, user.username);
  }

  /** 删除所有原料 */
  @Delete('del_all')
  @ApiOperation({ summary: '删除原料库所有原料' })
  removeAll(@CurrentUser() user: { username: string }) {
    return this.rawService.removeAll(user.username);
  }

  /** 下载模板 */
  @Get('template')
  @ApiOperation({ summary: '下载导入模板' })
  async downloadTemplate(@Res() res: Response) {
    const filePath = await this.rawService.getTemplateFilePath();
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=gl_material_info_template.xlsx',
    );
    res.sendFile(filePath, { root: process.cwd() });
  }
}
