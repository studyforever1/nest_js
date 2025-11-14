import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { PortMaterialInfoService } from '../services/port-material-info.service';

@ApiTags('港口含铁料信息管理')
@Controller('api/v1/port-material-info')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class PortMaterialInfoController {
  constructor(private readonly service: PortMaterialInfoService) {}

  @Post()
  @ApiOperation({ summary: '创建港口含铁料信息' })
  @UseGuards(PermissionsGuard)
  @Permissions('port-material-info:create')
  async create(@Body() data: any) { return await this.service.create(data); }

  @Get()
  @ApiOperation({ summary: '获取港口含铁料信息列表' })
  @UseGuards(PermissionsGuard)
  @Permissions('port-material-info:read')
  async findAll() { return await this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: '获取单个港口含铁料信息' })
  @UseGuards(PermissionsGuard)
  @Permissions('port-material-info:read')
  async findOne(@Param('id') id: string) { return await this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: '更新港口含铁料信息' })
  @UseGuards(PermissionsGuard)
  @Permissions('port-material-info:update')
  async update(@Param('id') id: string, @Body() data: any) { return await this.service.update(id, data); }

  @Delete(':id')
  @ApiOperation({ summary: '删除港口含铁料信息' })
  @UseGuards(PermissionsGuard)
  @Permissions('port-material-info:delete')
  async remove(@Param('id') id: string) { await this.service.remove(id); return { message: '删除成功' }; }
}
