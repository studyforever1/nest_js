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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody,ApiQuery } from '@nestjs/swagger';
import { SjRawMaterialService } from './sj-raw-material.service';
import { CreateSjRawMaterialDto } from './dto/create-sj-raw-material.dto';
import { UpdateSjRawMaterialDto } from './dto/update-sj-raw-material.dto';
import { RemoveSjRawMaterialDto } from './dto/remove-sj-raw-material.dto';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Response } from 'express';
import * as multer from 'multer';
import { PaginationDto } from './dto/pagination.dto';

@ApiTags('烧结原料库')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('sj-raw-material')
export class SjRawMaterialController {
  constructor(private readonly rawService: SjRawMaterialService) {}

  /** 新增原料 */
  @Post()
  @ApiOperation({ summary: '新增原料' })
  create(@Body() dto: CreateSjRawMaterialDto, @CurrentUser() user: { username: string }) {
    return this.rawService.create(dto, user.username);
  }

 @Get()
@ApiOperation({ summary: '查询所有原料（分页）' })
findAll(@Query() pagination: PaginationDto) {
  return this.rawService.findAll(pagination.page, pagination.pageSize);
}

@Get('search')
@ApiOperation({ summary: '按名字模糊查询原料（分页）' })
findByName(
  @Query('name') name: string,
  @Query() pagination: PaginationDto,
) {
  return this.rawService.findByName(name, pagination.page, pagination.pageSize);
}

@Get('search-by-type')
@ApiOperation({ summary: '按原料类型查询（分页）' })
findByType(
  @Query('type') type: 'T' | 'X' | 'R' | 'F',
  @Query() pagination: PaginationDto,
) {
  return this.rawService.findByType(type, pagination.page, pagination.pageSize);
}
  /** 更新原料 */
  @Put(':id')
  @ApiOperation({ summary: '更新原料' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSjRawMaterialDto,
    @CurrentUser() user: { username: string },
  ) {
    return this.rawService.update(+id, dto, user.username);
  }

  /** 删除原料（支持单个或多个） */
  @Delete()
  @ApiOperation({ summary: '删除原料（支持单个或多个）' })
  remove(@Body() dto: RemoveSjRawMaterialDto) {
    return this.rawService.remove(dto.ids);
  }

  /** 导出 Excel */
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

  /** 导入 Excel */
@Post('import')
@ApiOperation({ summary: '导入原料 Excel 文件' })
@ApiConsumes('multipart/form-data')
@UseInterceptors(
  FileInterceptor('file', {
    storage: multer.memoryStorage(), // 内存存储
  }),
)
@ApiBody({
  description: '上传 Excel 文件',
  required: true,
  schema: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'binary' }, // 告诉 Swagger 这是文件
    },
  },
})
async importExcel(
  @UploadedFile() file: Express.Multer.File,
  @CurrentUser() user: { username: string }, // ✅ 获取当前用户
) {
  if (!file || !file.buffer) {
    return { status: 'error', message: '请上传文件或文件为空' };
  }

  try {
    // ✅ 传入用户名给 Service
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

}
