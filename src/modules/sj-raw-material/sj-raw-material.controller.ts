import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SjRawMaterialService } from './sj-raw-material.service';
import { CreateSjRawMaterialDto } from './dto/create-sj-raw-material.dto';
import { UpdateSjRawMaterialDto } from './dto/update-sj-raw-material.dto';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Response } from 'express';


@ApiTags('烧结原料库')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('sj-raw-material')
export class SjRawMaterialController {
  constructor(private readonly rawService: SjRawMaterialService) {}

  /** 新增原料 */
  @Post()
  @ApiOperation({ summary: '新增原料' })
  create(
    @Body() dto: CreateSjRawMaterialDto,
    @CurrentUser() user: { username: string },
  ) {
    return this.rawService.create(dto, user.username); // 自动保存当前用户
  }

  /** 查询所有原料 */
  @Get()
  @ApiOperation({ summary: '查询所有原料' })
  findAll() {
    return this.rawService.findAll();
  }

  /** 按ID查询 */
  @Get(':id')
  @ApiOperation({ summary: '按ID查询原料' })
  findOne(@Param('id') id: string) {
    return this.rawService.findOne(+id);
  }

  /** 更新原料 */
  @Put(':id')
  @ApiOperation({ summary: '更新原料' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSjRawMaterialDto,
    @CurrentUser() user: { username: string },
  ) {
    return this.rawService.update(+id, dto, user.username); // 自动保存当前用户
  }

  /** 删除原料 */
  @Delete(':id')
  @ApiOperation({ summary: '删除原料' })
  remove(@Param('id') id: string) {
    return this.rawService.remove(+id); // 删除不需要用户信息
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
}

