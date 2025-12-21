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

import { CokeEconInfoService } from './coke-econ-info.service';
import { CreateCokeEconInfoDto } from './dto/create-coke-econ-info.dto';
import { UpdateCokeEconInfoDto } from './dto/update-coke-econ-info.dto';
import { RemoveCokeEconInfoDto } from './dto/remove-coke-econ-info.dto';
import { PaginationDto } from './dto/pagination.dto';

@ApiTags('经济性评价-焦炭信息库')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('coke-econ-info')
export class CokeEconInfoController {
  constructor(private readonly service: CokeEconInfoService) {}

  /** 新增 */
  @Post()
  @ApiOperation({ summary: '新增焦炭经济性信息' })
  create(
    @Body() dto: CreateCokeEconInfoDto,
    @CurrentUser() user: { username: string },
  ) {
    return this.service.create(dto, user.username);
  }

  /** 查询（分页 + 名称模糊） */
  @Get()
  @ApiOperation({ summary: '查询焦炭经济性信息（分页、名称模糊）' })
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
  @ApiOperation({ summary: '更新焦炭经济性信息' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCokeEconInfoDto,
    @CurrentUser() user: { username: string },
  ) {
    return this.service.update(+id, dto, user.username);
  }

  /** 批量删除 */
  @Delete()
  @ApiOperation({ summary: '删除焦炭经济性信息（支持批量）' })
  remove(@Body() dto: RemoveCokeEconInfoDto) {
    return this.service.remove(dto.ids);
  }

  /** 导出 Excel */
  @Get('export')
  @ApiOperation({ summary: '导出焦炭经济性信息 Excel' })
  async export(@Res() res: Response) {
    const buffer = await this.service.exportExcel();
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=coke_econ_info.xlsx',
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.end(buffer);
  }

  /** 导入 Excel */
  @Post('import')
  @ApiOperation({ summary: '导入焦炭经济性信息 Excel' })
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

  /** 清空 */
  @Delete('del_all')
  @ApiOperation({ summary: '清空焦炭经济性信息库' })
  removeAll(@CurrentUser() user: { username: string }) {
    return this.service.removeAll(user.username);
  }
}
