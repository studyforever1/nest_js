import { Controller, Put, Get, Body, Query, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { PelletEconConfigService } from './pellet-econ-config.service';
import {
  SavePelletEconConfigDto,
  SavePelletParamsDto,
  DeletePelletParamsDto,
  PelletEconPaginationDto,
} from './dto/pellet-econ-config.dto';

@ApiTags('球团经济性参数配置')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('pellet-econ-config')
export class PelletEconConfigController {
  constructor(private readonly service: PelletEconConfigService) {}

  private readonly MODULE_NAME = '外购球团经济性评价';

  /** 获取最新完整参数 */
  @Get('latest')
  @ApiOperation({ summary: '获取球团经济性参数' })
  async getLatest(@CurrentUser() user: User) {
    return this.service.getLatestConfig(user, this.MODULE_NAME);
  }

  /** 保存完整参数组（覆盖或合并） */
  @Put('save')
  @ApiOperation({ summary: '保存球团经济性参数' })
  async saveFullConfig(
    @CurrentUser() user: User,
    @Body() body: SavePelletEconConfigDto,
  ) {
    return this.service.saveFullConfig(user, this.MODULE_NAME, body.config_data);
  }

  /** 保存选中球团（全选 / 模糊筛选） */
  @Put('save-pellet')
  @ApiOperation({
    summary: '保存选中球团',
    description: `
⭕ 全选模式：selectedIds 覆盖 pelletParams  
⭕ 模糊查找模式：仅同步匹配 name 的球团
    `,
  })
  async saveSelected(
    @CurrentUser() user: User,
    @Body() body: SavePelletParamsDto,
  ) {
    return this.service.saveSelectedPellet(
      user,
      this.MODULE_NAME,
      body.selectedIds || [],
      body.name,
    );
  }

  /** 删除选中球团 */
  @Delete('pellet')
  @ApiOperation({ summary: '删除选中球团' })
  async deleteSelected(
    @CurrentUser() user: User,
    @Body() body: DeletePelletParamsDto,
  ) {
    return this.service.deletePelletParams(user, this.MODULE_NAME, body.removeIds);
  }

  /** 获取已选球团（分页 + 名称模糊） */
  @Get('selected-pellet')
  @ApiOperation({ summary: '获取已选球团（分页、名称模糊）' })
  async getSelected(
    @CurrentUser() user: User,
    @Query() query: PelletEconPaginationDto,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    return this.service.getSelectedPellet(
      user,
      this.MODULE_NAME,
      page,
      pageSize,
      query.name,
    );
  }
}
