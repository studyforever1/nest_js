import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { MineTypIndService } from '../services/mine-typ-ind.service';

@ApiTags('主要矿山典型指标')
@Controller('api/v1/mine-typ-ind')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class MineTypIndController {
  constructor(private readonly service: MineTypIndService) {}

  @Post()
  @ApiOperation({ summary: '创建主要矿山典型指标' })
  @UseGuards(PermissionsGuard)
  @Permissions('mine-typ-ind:create')
  async create(@Body() data: any) {
    return await this.service.create(data);
  }

  @Get()
  @ApiOperation({ summary: '获取主要矿山典型指标列表' })
  @UseGuards(PermissionsGuard)
  @Permissions('mine-typ-ind:read')
  async findAll() {
    return await this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个主要矿山典型指标' })
  @UseGuards(PermissionsGuard)
  @Permissions('mine-typ-ind:read')
  async findOne(@Param('id') id: string) {
    return await this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新主要矿山典型指标' })
  @UseGuards(PermissionsGuard)
  @Permissions('mine-typ-ind:update')
  async update(@Param('id') id: string, @Body() data: any) {
    return await this.service.update(id, data);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除主要矿山典型指标' })
  @UseGuards(PermissionsGuard)
  @Permissions('mine-typ-ind:delete')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { message: '删除成功' };
  }
}
