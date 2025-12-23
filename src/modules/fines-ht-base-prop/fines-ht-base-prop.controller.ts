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
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Response } from 'express';
import * as multer from 'multer';

import { FinesHtBasePropService } from './fines-ht-base-prop.service';
import { CreateFinesHtBasePropDto } from './dto/create-fines-ht-base-prop.dto';
import { UpdateFinesHtBasePropDto } from './dto/update-fines-ht-base-prop.dto';
import { RemoveFinesHtBasePropDto } from './dto/remove-fines-ht-base-prop.dto';
import { PaginationDto } from './dto/pagination.dto';

@ApiTags('铁矿粉高温基础特性数据库')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('fines-ht-base-prop')
export class FinesHtBasePropController {
  constructor(private readonly service: FinesHtBasePropService) {}

  /** 新增 */
  @Post()
  @ApiOperation({ summary: '新增铁矿粉高温基础特性' })
  create(
    @Body() dto: CreateFinesHtBasePropDto,
    @CurrentUser() user: { username: string },
  ) {
    return this.service.create(dto, user.username);
  }

  /** 查询（分页 + 名称模糊） */
  @Get()
  @ApiOperation({ summary: '查询铁矿粉高温基础特性（分页、名称模糊）' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'name', required: false })
  findAll(
    @Query() pagination: PaginationDto,
    @Query('name') name?: string,
  ) {
    return this.service.query({
      page: pagination.page ?? 1,
      pageSize: pagination.pageSize ?? 10,
      name,
    });
  }

  /** 更新 */
  @Put(':id')
  @ApiOperation({ summary: '更新铁矿粉高温基础特性' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFinesHtBasePropDto,
    @CurrentUser() user: { username: string },
  ) {
    return this.service.update(+id, dto, user.username);
  }

  /** 批量删除 */
  @Delete()
  @ApiOperation({ summary: '删除铁矿粉高温基础特性（支持批量）' })
  remove(@Body() dto: RemoveFinesHtBasePropDto) {
    return this.service.remove(dto.ids);
  }

  /** 清空 */
  @Delete('del_all')
  @ApiOperation({ summary: '清空铁矿粉高温基础特性数据库' })
  removeAll(@CurrentUser() user: { username: string }) {
    return this.service.removeAll(user.username);
  }

  /** 导出 Excel */
  @Get('export')
  @ApiOperation({ summary: '导出铁矿粉高温基础特性 Excel' })
  async export(@Res() res: Response) {
    const buffer = await this.service.exportExcel();
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=fines_ht_base_prop.xlsx',
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.end(buffer);
  }

  /** 导入 Excel */
  @Post('import')
  @ApiOperation({ summary: '导入铁矿粉高温基础特性 Excel' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { storage: multer.memoryStorage() }),
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
    return this.service.importExcel(file, user.username);
  }
}
