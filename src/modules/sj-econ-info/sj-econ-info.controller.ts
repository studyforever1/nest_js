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

@ApiTags('烧结原料经济性评价-烧结原料信息库')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('sj-econ-info')
export class SjEconInfoController {
  constructor(private readonly econService: SjEconInfoService) {}

  /** 新增 */
  @Post()
  @ApiOperation({ summary: '新增烧结原料信息' })
  create(
    @Body() dto: CreateSjEconInfoDto,
    @CurrentUser() user: { username: string },
  ) {
    return this.econService.create(dto, user.username);
  }

  /** 查询（分页 + 名称模糊） */
  @Get()
  @ApiOperation({ summary: '查询烧结原料信息（分页、名称模糊）' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'name', required: false })
  findAll(
    @Query() pagination: PaginationDto,
    @Query('name') name?: string,
  ) {
    return this.econService.query({
      page: pagination.page ?? 1,
      pageSize: pagination.pageSize ?? 10,
      name,
    });
  }

  /** 更新 */
  @Put(':id')
  @ApiOperation({ summary: '更新烧结原料信息' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSjEconInfoDto,
    @CurrentUser() user: { username: string },
  ) {
    return this.econService.update(+id, dto, user.username);
  }

  /** 批量删除 */
  @Delete()
  @ApiOperation({ summary: '删除烧结原料信息（支持批量）' })
  remove(@Body() dto: RemoveSjEconInfoDto) {
    return this.econService.remove(dto.ids);
  }

  /** 导出 Excel */
  @Get('export')
  @ApiOperation({ summary: '导出烧结原料信息 Excel' })
  async export(@Res() res: Response) {
    const buffer = await this.econService.exportExcel();
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=sj_econ_info.xlsx',
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.end(buffer);
  }

  /** 导入 Excel */
  @Post('import')
  @ApiOperation({ summary: '导入烧结原料信息 Excel' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
    }),
  )
  @ApiBody({
    required: true,
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
    return this.econService.importExcel(file, user.username);
  }

  /** 删除全部 */
  @Delete('del_all')
  @ApiOperation({ summary: '清空经济指标库' })
  removeAll(@CurrentUser() user: { username: string }) {
    return this.econService.removeAll(user.username);
  }
}
