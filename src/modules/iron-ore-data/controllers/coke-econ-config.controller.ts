import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CokeEconConfigService } from '../services/coke-econ-config.service';

@ApiTags('焦炭经济性评价参数设置')
@Controller('api/v1/coke-econ-config')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class CokeEconConfigController {
  constructor(private readonly service: CokeEconConfigService) {}

  @Post()
  @ApiOperation({ summary: '创建焦炭经济性评价参数' })
  @UseGuards(PermissionsGuard)
  @Permissions('coke-econ-config:create')
  async create(@Body() data: any) { return await this.service.create(data); }

  @Get()
  @ApiOperation({ summary: '获取焦炭经济性评价参数列表' })
  @UseGuards(PermissionsGuard)
  @Permissions('coke-econ-config:read')
  async findAll() { return await this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: '获取单个焦炭经济性评价参数' })
  @UseGuards(PermissionsGuard)
  @Permissions('coke-econ-config:read')
  async findOne(@Param('id') id: string) { return await this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: '更新焦炭经济性评价参数' })
  @UseGuards(PermissionsGuard)
  @Permissions('coke-econ-config:update')
  async update(@Param('id') id: string, @Body() data: any) { return await this.service.update(id, data); }

  @Delete(':id')
  @ApiOperation({ summary: '删除焦炭经济性评价参数' })
  @UseGuards(PermissionsGuard)
  @Permissions('coke-econ-config:delete')
  async remove(@Param('id') id: string) { await this.service.remove(id); return { message: '删除成功' }; }
}
