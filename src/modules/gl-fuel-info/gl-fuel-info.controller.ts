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
import { GlFuelInfoService } from './gl-fuel-info.service';
import { CreateGlFuelInfoDto } from './dto/create-gl-fuel-info.dto';
import { UpdateGlFuelInfoDto } from './dto/update-gl-fuel-info.dto';
import { RemoveGlFuelInfoDto } from './dto/remove-gl-fuel-info.dto';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Response } from 'express';
import * as multer from 'multer';
import { PaginationDto } from './dto/pagination.dto';
import { User } from '../user/entities/user.entity';


@ApiTags('物料信息-高炉燃料信息')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('gl-fuel-info')
export class GlFuelInfoController {
  constructor(private readonly rawService: GlFuelInfoService) {}

  /** 新增原料 */
  @Post()
  @ApiOperation({ summary: '添加按钮' ,
    description: '对应烧结物料信息中的添加按钮，在烧结物料信息库中添加新的物料'  })
  create(@Body() dto: CreateGlFuelInfoDto, @CurrentUser() user: { username: string }) {
    return this.rawService.create(dto, user.username);
  }

  /**
   * 查询（统一接口）
   * 保留原来 /sj-raw-material (分页)
   * 原来的 /search 和 /search-by-type 仍可使用（兼容前端），但建议统一请求到这里。
   */
@Get()
@ApiOperation({ summary: '查询原料（支持分页、名称模糊、类型筛选、排序）' })
async findAll(
  @CurrentUser() user: User,
  @Query() query: PaginationDto,
) {
  return this.rawService.query(user, {
    page: query.page,
    pageSize: query.pageSize,
    name: query.name,
    type: query.type,
    sort: query.sort,
    order: query.order,
  });
}


  /** 更新原料 */
  @Put(':id')
  @ApiOperation({ summary: '保存按钮' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGlFuelInfoDto,
    @CurrentUser() user: { username: string },
  ) {
    return this.rawService.update(+id, dto, user.username);
  }

  /** 删除原料（支持单个或多个） */
  @Delete()
  @ApiOperation({ summary: '删除原料（支持单个或多个）' })
  remove(@Body() dto: RemoveGlFuelInfoDto) {
    return this.rawService.remove(dto.ids);
  }

  /** 导出 Excel */
  @Get('export')
  @ApiOperation({ summary: '导出原料数据为 Excel' })
  async export(@Res() res: Response) {
    const buffer = await this.rawService.exportExcel();
    res.setHeader('Content-Disposition', 'attachment; filename=gl_fuel_info.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.end(buffer);
  }

  /** 导入 Excel */
  @Post('import')
  @ApiOperation({ summary: '导入原料 Excel 文件' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
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
  async importExcel(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: { username: string }) {
    if (!file || !file.buffer) {
      return { status: 'error', message: '请上传文件或文件为空' };
    }

    try {
      return await this.rawService.importExcel(file, user.username);
    } catch (error) {
      console.error(error);
      return { status: 'error', message: '导入失败，文件格式可能有误' };
    }
  }

  /** 删除所有原料 */
  @Delete('del_all')
  @ApiOperation({ summary: '删除原料库所有原料' })
  async removeAll(@CurrentUser() user: { username: string }) {
    try {
      return await this.rawService.removeAll(user.username);
    } catch (error) {
      console.error(error);
      return { status: 'error', message: '删除失败' };
    }
  }

  @Get('template')
  @ApiOperation({ summary: '下载导入模板（按 FIXED_HEADERS 表头顺序）' })
  async downloadTemplate(@Res() res: Response) {
    const filePath = await this.rawService.getTemplateFilePath();
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=gl_fuel_info_template.xlsx',
    );
    res.sendFile(filePath, { root: process.cwd() });
  }



   /** 导入 Excel（批量修改） */
   @Post('import-batch-update')
   @ApiOperation({ summary: '导入原料 Excel 文件（按物料名称批量修改）' })
   @ApiConsumes('multipart/form-data')
   @UseInterceptors(
     FileInterceptor('file', {
       storage: multer.memoryStorage(),
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
   async importExcelBatchUpdate(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: { username: string }) {
     if (!file || !file.buffer) {
       return { status: 'error', message: '请上传文件或文件为空' };
     }
 
     try {
       return await this.rawService.importExcelBatchUpdate(file, user.username);
     } catch (error) {
       console.error(error);
       return { status: 'error', message: '批量修改失败，文件格式可能有误' };
     }
   }
   @Get('template-batch-update')
   @ApiOperation({ summary: '下载批量修改导入模板（按物料名称更新已有数据）' })
   async downloadBatchUpdateTemplate(@Res() res: Response) {
     const filePath = await this.rawService.getBatchUpdateTemplateFilePath();
     res.setHeader(
       'Content-Disposition',
       'attachment; filename=gl_fuel_info_batch_update_template.xlsx',
     );
     res.sendFile(filePath, { root: process.cwd() });
   }
   

   
}
