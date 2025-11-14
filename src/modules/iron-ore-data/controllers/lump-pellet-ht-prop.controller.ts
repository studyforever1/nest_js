import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { LumpPelletHtPropService } from '../services/lump-pellet-ht-prop.service';

@ApiTags('铁矿粉高温基础特性(块矿/球团)')
@Controller('api/v1/lump-pellet-ht-prop')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class LumpPelletHtPropController {
  constructor(private readonly service: LumpPelletHtPropService) {}

  @Post()
  @ApiOperation({ summary: '创建铁矿粉高温基础特性' })
  @UseGuards(PermissionsGuard)
  @Permissions('lump-pellet-ht-prop:create')
  async create(@Body() data: any) { return await this.service.create(data); }

  @Get()
  @ApiOperation({ summary: '获取铁矿粉高温基础特性列表' })
  @UseGuards(PermissionsGuard)
  @Permissions('lump-pellet-ht-prop:read')
  async findAll() { return await this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: '获取单个铁矿粉高温基础特性' })
  @UseGuards(PermissionsGuard)
  @Permissions('lump-pellet-ht-prop:read')
  async findOne(@Param('id') id: string) { return await this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: '更新铁矿粉高温基础特性' })
  @UseGuards(PermissionsGuard)
  @Permissions('lump-pellet-ht-prop:update')
  async update(@Param('id') id: string, @Body() data: any) { return await this.service.update(id, data); }

  @Delete(':id')
  @ApiOperation({ summary: '删除铁矿粉高温基础特性' })
  @UseGuards(PermissionsGuard)
  @Permissions('lump-pellet-ht-prop:delete')
  async remove(@Param('id') id: string) { await this.service.remove(id); return { message: '删除成功' }; }
}
