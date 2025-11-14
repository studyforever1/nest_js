import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CoalEconConfigService } from '../services/coal-econ-config.service';

@ApiTags('喷吹煤经济性评价参数设置')
@Controller('api/v1/coal-econ-config')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class CoalEconConfigController {
  constructor(private readonly service: CoalEconConfigService) {}

  @Post()
  @ApiOperation({ summary: '创建喷吹煤经济性评价参数' })
  @UseGuards(PermissionsGuard)
  @Permissions('coal-econ-config:create')
  async create(@Body() data: any) { return await this.service.create(data); }

  @Get()
  @ApiOperation({ summary: '获取喷吹煤经济性评价参数列表' })
  @UseGuards(PermissionsGuard)
  @Permissions('coal-econ-config:read')
  async findAll() { return await this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: '获取单个喷吹煤经济性评价参数' })
  @UseGuards(PermissionsGuard)
  @Permissions('coal-econ-config:read')
  async findOne(@Param('id') id: string) { return await this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: '更新喷吹煤经济性评价参数' })
  @UseGuards(PermissionsGuard)
  @Permissions('coal-econ-config:update')
  async update(@Param('id') id: string, @Body() data: any) { return await this.service.update(id, data); }

  @Delete(':id')
  @ApiOperation({ summary: '删除喷吹煤经济性评价参数' })
  @UseGuards(PermissionsGuard)
  @Permissions('coal-econ-config:delete')
  async remove(@Param('id') id: string) { await this.service.remove(id); return { message: '删除成功' }; }
}
