import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CoalEconInfoService } from '../services/coal-econ-info.service';

@ApiTags('喷吹煤成分价格信息管理')
@Controller('api/v1/coal-econ-info')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class CoalEconInfoController {
  constructor(private readonly service: CoalEconInfoService) {}

  @Post()
  @ApiOperation({ summary: '创建喷吹煤成分价格信息' })
  @UseGuards(PermissionsGuard)
  @Permissions('coal-econ-info:create')
  async create(@Body() data: any) { return await this.service.create(data); }

  @Get()
  @ApiOperation({ summary: '获取喷吹煤成分价格信息列表' })
  @UseGuards(PermissionsGuard)
  @Permissions('coal-econ-info:read')
  async findAll() { return await this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: '获取单个喷吹煤成分价格信息' })
  @UseGuards(PermissionsGuard)
  @Permissions('coal-econ-info:read')
  async findOne(@Param('id') id: string) { return await this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: '更新喷吹煤成分价格信息' })
  @UseGuards(PermissionsGuard)
  @Permissions('coal-econ-info:update')
  async update(@Param('id') id: string, @Body() data: any) { return await this.service.update(id, data); }

  @Delete(':id')
  @ApiOperation({ summary: '删除喷吹煤成分价格信息' })
  @UseGuards(PermissionsGuard)
  @Permissions('coal-econ-info:delete')
  async remove(@Param('id') id: string) { await this.service.remove(id); return { message: '删除成功' }; }
}
