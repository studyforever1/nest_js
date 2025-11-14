import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CokeEconInfoService } from '../services/coke-econ-info.service';

@ApiTags('焦炭成分价格信息管理')
@Controller('api/v1/coke-econ-info')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class CokeEconInfoController {
  constructor(private readonly service: CokeEconInfoService) {}

  @Post()
  @ApiOperation({ summary: '创建焦炭成分价格信息' })
  @UseGuards(PermissionsGuard)
  @Permissions('coke-econ-info:create')
  async create(@Body() data: any) { return await this.service.create(data); }

  @Get()
  @ApiOperation({ summary: '获取焦炭成分价格信息列表' })
  @UseGuards(PermissionsGuard)
  @Permissions('coke-econ-info:read')
  async findAll() { return await this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: '获取单个焦炭成分价格信息' })
  @UseGuards(PermissionsGuard)
  @Permissions('coke-econ-info:read')
  async findOne(@Param('id') id: string) { return await this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: '更新焦炭成分价格信息' })
  @UseGuards(PermissionsGuard)
  @Permissions('coke-econ-info:update')
  async update(@Param('id') id: string, @Body() data: any) { return await this.service.update(id, data); }

  @Delete(':id')
  @ApiOperation({ summary: '删除焦炭成分价格信息' })
  @UseGuards(PermissionsGuard)
  @Permissions('coke-econ-info:delete')
  async remove(@Param('id') id: string) { await this.service.remove(id); return { message: '删除成功' }; }
}
