import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Patch,
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
import { SjEconInfoService } from './sj-econ-info.service';
import { CreateSjEconInfoDto } from './dto/create-sj-econ-info.dto';
import { UpdateSjEconInfoDto } from './dto/update-sj-econ-info.dto';
import { RemoveSjEconInfoDto } from './dto/remove-sj-econ-info.dto';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Response } from 'express';
import * as multer from 'multer';
import { PaginationDto } from './dto/pagination.dto';
import { ApiResponse } from '../../common/response/response.dto';

@ApiTags('烧结原料经济性评价信息管理')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('sj-econ-info')
export class SjEconInfoController {
  constructor(private readonly sjEconInfoService: SjEconInfoService) {}

  /**
   * 新增烧结矿粉接口
   */
  @Post()
  @ApiOperation({
    summary: '新增烧结矿粉',
    description: '在烧结原料经济性评价信息库中添加新的原料信息',
  })
  async create(@Body() dto: CreateSjEconInfoDto, @CurrentUser() user: { username: string }) {
    try {
      const data = await this.sjEconInfoService.create(dto, user.username);
      return ApiResponse.success({ data }, '新增原料成功');
    } catch (error: any) {
      const message = error.message || '参数错误：名称不能为空';
      return ApiResponse.error(message, 4001);
    }
  }

  /**
   * 修改烧结矿粉接口
   */
  @Patch(':id')
  @ApiOperation({
    summary: '修改烧结矿粉',
    description: '更新指定ID的原料信息',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSjEconInfoDto,
    @CurrentUser() user: { username: string },
  ) {
    try {
      const data = await this.sjEconInfoService.update(+id, dto, user.username);
      return ApiResponse.success({ data }, '修改原料成功');
    } catch (error: any) {
      const message = error.message || '参数错误：名称不能为空';
      return ApiResponse.error(message, 4001);
    }
  }

  /**
   * 删除烧结矿粉接口
   */
  @Delete()
  @ApiOperation({
    summary: '删除烧结矿粉',
    description: '批量删除原料（支持单个或多个）',
  })
  remove(@Body() dto: RemoveSjEconInfoDto) {
    return this.sjEconInfoService.remove(dto.ids);
  }

  /**
   * 查找烧结矿粉接口
   */
  @Get()
  @ApiOperation({
    summary: '获取所有原料信息',
    description: '查询原料列表（支持分页、名称模糊搜索）',
  })
  @ApiQuery({ name: 'page', required: false, description: '页码', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页条数', example: 2 })
  @ApiQuery({ name: 'name', required: false, description: '名称模糊搜索' })
  async findAll(@Query() pagination: PaginationDto) {
    try {
      const result = await this.sjEconInfoService.query({
        page: pagination.page ?? 1,
        pageSize: pagination.pageSize ?? 10,
        name: pagination.name,
      });
      return ApiResponse.success(result, '获取列表成功');
    } catch (error: any) {
      const message = error.message || '获取列表失败：参数错误或数据不存在';
      // 错误时返回空数组和分页信息
      const page = pagination.page ?? 1;
      const pageSize = pagination.pageSize ?? 10;
      return {
        code: 4003,
        message,
        data: {
          data: [],
          pagination: {
            total: 0,
            page,
            pageSize,
            totalPages: 0,
          },
        },
      };
    }
  }

  /**
   * 按照名字模糊查找
   */
  @Get('search')
  @ApiOperation({
    summary: '按照名字模糊查找',
    description: '根据名称模糊搜索原料列表（支持分页）',
  })
  @ApiQuery({ name: 'name', required: true, description: '名称关键字（模糊搜索）', example: '木' })
  @ApiQuery({ name: 'page', required: false, description: '页码', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页条数', example: 2 })
  async search(
    @Query('name') name: string,
    @Query() pagination: PaginationDto,
  ) {
    try {
      if (!name || name.trim() === '') {
        return {
          code: 4003,
          message: '搜索失败：名称参数不能为空',
          data: {
            data: [],
            pagination: {
              total: 0,
              page: pagination.page ?? 1,
              pageSize: pagination.pageSize ?? 10,
              totalPages: 0,
            },
          },
        };
      }
      const result = await this.sjEconInfoService.query({
        page: pagination.page ?? 1,
        pageSize: pagination.pageSize ?? 10,
        name: name.trim(),
      });
      return ApiResponse.success(result, 'success');
    } catch (error: any) {
      const message = error.message || '搜索失败：参数错误或数据不存在';
      const page = pagination.page ?? 1;
      const pageSize = pagination.pageSize ?? 10;
      return {
        code: 4003,
        message,
        data: {
          data: [],
          pagination: {
            total: 0,
            page,
            pageSize,
            totalPages: 0,
          },
        },
      };
    }
  }

  /**
   * 根据ID查询单个
   */
  @Get(':id')
  @ApiOperation({
    summary: '根据ID查询单个原料',
    description: '获取指定ID的原料详细信息',
  })
  async findOne(@Param('id') id: string) {
    try {
      const data = await this.sjEconInfoService.findOne(+id);
      return ApiResponse.success({ data }, '获取成功');
    } catch (error: any) {
      const message = error.message || '获取失败：原料不存在';
      return ApiResponse.error(message, 4001);
    }
  }

  /**
   * 导出Excel
   */
  @Get('export')
  @ApiOperation({
    summary: '导出原料Excel',
    description: '将当前所有启用的原料数据导出为Excel文件，包含列：原料、TFe、CaO、SiO2、MgO、Al2O3、S、P、TiO2、K2O、Na2O、Zn、Pb、As、V2O5、烧损、价格',
  })
  async export(@Res() res: Response) {
    const buffer = await this.sjEconInfoService.exportExcel();
    res.setHeader('Content-Disposition', 'attachment; filename=sj_econ_info.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.end(buffer);
  }

  /**
   * 导入Excel
   */
  @Post('import')
  @ApiOperation({
    summary: '导入原料excel',
    description: '从Excel文件批量导入原料数据，支持列：原料、TFe、CaO、SiO2、MgO、Al2O3、S、P、TiO2、K2O、Na2O、Zn、Pb、As、V2O5、烧损、价格',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
    }),
  )
  @ApiBody({
    description: '上传Excel文件',
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
      return {
        code: 4005,
        message: '导入失败: 文件格式错误或数据校验不通过',
        data: {
          importedCount: 0,
        },
      };
    }

    try {
      return await this.sjEconInfoService.importExcel(file, user.username);
    } catch (error: any) {
      console.error(error);
      return {
        code: 4005,
        message: '导入失败: 文件格式错误或数据校验不通过',
        data: {
          importedCount: 0,
        },
      };
    }
  }
}

