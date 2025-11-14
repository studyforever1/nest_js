import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { SjEconInfoService } from '../services/sj-econ-info.service';
import { ApiResponse } from '../../../common/response/response.dto';
import { ApiOkResponseData, ApiErrorResponse } from '../../../common/response/response.decorator';
import * as fs from 'fs';

@ApiTags('烧结原料经济性评价信息管理')
@Controller('api/v1/sj-econ-info')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class SjEconInfoController {
  constructor(private readonly service: SjEconInfoService) {}

  /**
   * 1. 新增原料
   * POST /sj-econ-info
   */
  @Post()
  @ApiOperation({ summary: '新增原料' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-econ-info:create')
  @ApiOkResponseData(Object)
  @ApiErrorResponse()
  async create(@Body() data: any) {
    try {
      // 兼容扁平请求体：将化学成分字段收拢到 composition
      const knownKeys = [
        'TFe','CaO','SiO2','MgO','Al2O3','S','P','TiO2','K2O','Na2O','Zn','Pb','As','V2O5','H2O','烧损','价格'
      ];
      const composition: Record<string, any> = {};
      for (const key of knownKeys) {
        if (data[key] !== undefined) composition[key] = data[key];
      }
      const payload = {
        name: data.name,
        composition: data.composition ?? composition,
        modifier: data.modifier,
      };

      const result = await this.service.create(payload);
      return ApiResponse.success(
        {
          result: {
            id: result.id,
            name: result.name,
            composition: result.composition,
            enabled: result.enabled,
            modifier: result.modifier,
            created_at: result.createdAt,
            updated_at: result.updatedAt,
          },
        },
        '新增原料成功',
      );
    } catch (error) {
      return ApiResponse.error(error.message || '新增原料失败', 4001);
    }
  }

  /**
   * 2. 批量删除原料
   * DELETE /sj-econ-info
   */
  @Delete()
  @ApiOperation({ summary: '批量删除原料' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-econ-info:delete')
  @ApiOkResponseData(Object)
  @ApiErrorResponse()
  async removeBatch(@Body() body: { ids: string[] }) {
    try {
      const result = await this.service.removeBatch(body.ids);
      return ApiResponse.success({ result }, 'success');
    } catch (error) {
      return ApiResponse.error(error.message || '删除失败,参数错误或数据不存在', 1002);
    }
  }

  /**
   * 3. 修改原料
   * PATCH /sj-econ-info/:id
   */
  @Patch(':id')
  @ApiOperation({ summary: '修改原料' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-econ-info:update')
  @ApiOkResponseData(Object)
  @ApiErrorResponse()
  async update(@Param('id') id: string, @Body() data: any) {
    try {
      // 兼容扁平请求体：将化学成分字段收拢到 composition
      const knownKeys = [
        'TFe','CaO','SiO2','MgO','Al2O3','S','P','TiO2','K2O','Na2O','Zn','Pb','As','V2O5','H2O','烧损','价格'
      ];
      const composition: Record<string, any> = {};
      for (const key of knownKeys) {
        if (data[key] !== undefined) composition[key] = data[key];
      }
      const payload: { name?: string; composition?: Record<string, any>; modifier?: string } = {
        name: data.name,
        composition: data.composition ?? (Object.keys(composition).length > 0 ? composition : undefined),
        modifier: data.modifier,
      };

      const result = await this.service.update(id, payload);
      return ApiResponse.success(
        {
          result: {
            id: result.id,
            name: result.name,
            composition: result.composition,
          },
        },
        'success',
      );
    } catch (error) {
      return ApiResponse.error(error.message || '参数错误：名称不能为空', 4001);
    }
  }

  /**
   * 4. 获取所有原料信息（分页）
   * GET /sj-econ-info?page=1&pageSize=2
   */
  @Get()
  @ApiOperation({ summary: '获取所有原料信息（分页）' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-econ-info:read')
  @ApiOkResponseData(Object)
  @ApiErrorResponse()
  async findAll(@Query('page') page: string = '1', @Query('pageSize') pageSize: string = '10') {
    try {
      const pageNum = parseInt(page, 10) || 1;
      const pageSizeNum = parseInt(pageSize, 10) || 10;
      const result = await this.service.findAll(pageNum, pageSizeNum);
      return ApiResponse.success({ result: result.result, pagination: result.pagination }, 'success');
    } catch (error) {
      return ApiResponse.error(error.message || '获取列表失败:参数错误或数据不存在', 4003);
    }
  }

  /**
   * 5. 按照名字模糊查找
   * GET /sj-econ-info/search?name=木&page=1&pageSize=2
   */
  @Get('search')
  @ApiOperation({ summary: '按照名字模糊查找' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-econ-info:read')
  @ApiOkResponseData(Object)
  @ApiErrorResponse()
  async search(@Query('name') name: string, @Query('page') page: string = '1', @Query('pageSize') pageSize: string = '10') {
    try {
      const pageNum = parseInt(page, 10) || 1;
      const pageSizeNum = parseInt(pageSize, 10) || 10;
      const result = await this.service.searchByName(name, pageNum, pageSizeNum);
      return ApiResponse.success({ result: result.result, pagination: result.pagination }, 'success');
    } catch (error) {
      return ApiResponse.error(error.message || '搜索失败', 4003);
    }
  }

  /**
   * 6. 导入原料Excel
   * POST /sj-econ-info/import
   */
  @Post('import')
  @ApiOperation({ summary: '导入原料Excel' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-econ-info:import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOkResponseData(Object)
  @ApiErrorResponse()
  async import(@UploadedFile() file: Express.Multer.File) {
    try {
      if (!file) {
        return ApiResponse.error('导入失败：文件格式错误或数据校验不通过', 4005);
      }
      const result = await this.service.importFromExcel(file);
      return ApiResponse.success({ result: { importedCount: result.importedCount } }, `成功导入 ${result.importedCount} 条数据`);
    } catch (error) {
      return ApiResponse.error(error.message || '导入失败：文件格式错误或数据校验不通过', 4005);
    }
  }

  /**
   * 7. 导出原料Excel
   * GET /sj-econ-info/exportport
   */
  @Get('exportport')
  @ApiOperation({ summary: '导出原料Excel' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-econ-info:export')
  async export(@Res() res: Response) {
    try {
      const filePath = await this.service.exportToExcel();
      const filename = `sj-econ-info-export-${Date.now()}.txt`;
      
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      
      fileStream.on('end', () => {
        // 清理临时文件
        fs.unlink(filePath, () => {});
      });
    } catch (error) {
      res.status(400).json(ApiResponse.error(error.message || '导出失败', 4005));
    }
  }

  /**
   * 获取单个原料信息（兼容旧接口）
   * GET /sj-econ-info/:id
   */
  @Get(':id')
  @ApiOperation({ summary: '获取单个烧结原料经济性评价信息' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-econ-info:read')
  @ApiOkResponseData(Object)
  @ApiErrorResponse()
  async findOne(@Param('id') id: string) {
    try {
      const result = await this.service.findOne(id);
      return ApiResponse.success(
        {
          result: {
            id: result.id,
            name: result.name,
            composition: result.composition,
            enabled: result.enabled,
            modifier: result.modifier,
            created_at: result.createdAt,
            updated_at: result.updatedAt,
          },
        },
        'success',
      );
    } catch (error) {
      return ApiResponse.error(error.message || '数据不存在', 4003);
    }
  }

  /**
   * 单个删除原料（兼容旧接口）
   * DELETE /sj-econ-info/:id
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除烧结原料经济性评价信息' })
  @UseGuards(PermissionsGuard)
  @Permissions('sj-econ-info:delete')
  @ApiOkResponseData(Object)
  @ApiErrorResponse()
  async remove(@Param('id') id: string) {
    try {
      await this.service.remove(id);
      return ApiResponse.success({ result: { deletedCount: 1, ids: [id] } }, '删除成功');
    } catch (error) {
      return ApiResponse.error(error.message || '删除失败,参数错误或数据不存在', 1002);
    }
  }
}
