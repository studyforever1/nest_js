import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { FinesHtBasePropService } from '../services/fines-ht-base-prop.service';

@ApiTags('铁矿粉高温基础特性(粉矿)')
@Controller('api/v1/fines-ht-base-prop')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class FinesHtBasePropController {
  constructor(private readonly service: FinesHtBasePropService) {}

  @Post()
  @ApiOperation({ summary: '创建铁矿粉高温基础特性' })
  @UseGuards(PermissionsGuard)
  @Permissions('fines-ht-base-prop:create')
  async create(@Body() data: any) { return await this.service.create(data); }

  @Get()
  @ApiOperation({ summary: '获取铁矿粉高温基础特性列表' })
  @UseGuards(PermissionsGuard)
  @Permissions('fines-ht-base-prop:read')
  async findAll() { return await this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: '获取单个铁矿粉高温基础特性' })
  @UseGuards(PermissionsGuard)
  @Permissions('fines-ht-base-prop:read')
  async findOne(@Param('id') id: string) { return await this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: '更新铁矿粉高温基础特性' })
  @UseGuards(PermissionsGuard)
  @Permissions('fines-ht-base-prop:update')
  async update(@Param('id') id: string, @Body() data: any) { return await this.service.update(id, data); }

  @Delete(':id')
  @ApiOperation({ summary: '删除铁矿粉高温基础特性' })
  @UseGuards(PermissionsGuard)
  @Permissions('fines-ht-base-prop:delete')
  async remove(@Param('id') id: string) { await this.service.remove(id); return { message: '删除成功' }; }
}
