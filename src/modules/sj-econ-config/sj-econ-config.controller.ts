import { Controller, Put, Get, Post, Body, Query, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { SjEconConfigService } from './sj-econ-config.service';
import {
  SaveSjEconConfigDto,
  SaveSjEconIngredientsDto,
  DeleteSjEconIngredientsDto,
  SjEconPaginationDto,
} from './dto/sj-econ-config.dto';

@ApiTags('烧结原料经济性评价-参数配置')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('sj-econ-config')
export class SjEconConfigController {
  constructor(private readonly service: SjEconConfigService) {}

  private readonly MODULE_NAME = '烧结原料经济性评价';

  /** 获取最新完整参数组 */
  @Get('latest')
  @ApiOperation({ summary: '获取烧结原料经济性评价参数' })
  async latest(@CurrentUser() user: User) {
    return this.service.getLatestConfigByName(user, this.MODULE_NAME);
  }

  /** 保存完整参数组（覆盖模式） */
  @Put('save')
  @ApiOperation({ summary: '保存原料经济性评价参数' })
  async save(
    @CurrentUser() user: User,
    @Body() body: SaveSjEconConfigDto,
  ) {
    return this.service.saveFullConfig(user, this.MODULE_NAME, body.config_data);
  }

  /** 保存选中原料（全选模式 + 模糊查找模式） */
  @Put('save-ingredients')
  @ApiOperation({
    summary: '保存选中原料',
    description: `
⭕ 全选模式：selectedIds 覆盖原有 ingredientParams  
⭕ 模糊查找模式：仅更新匹配 name 的原料，增量同步
    `,
  })
  async saveIngredients(
    @CurrentUser() user: User,
    @Body() body: SaveSjEconIngredientsDto,
  ) {
    return this.service.saveSelectedIngredients(
      user,
      this.MODULE_NAME,
      body.selectedIds,
      body.name,
    );
  }

  /** 删除选中原料 */
  @Delete('ingredients')
  @ApiOperation({ summary: '删除选中原料' })
  async deleteIngredients(
    @CurrentUser() user: User,
    @Body() body: DeleteSjEconIngredientsDto,
  ) {
    return this.service.deleteIngredients(user, this.MODULE_NAME, body.removeIds);
  }

  /** 获取已选原料（分页 + 模糊查找） */
  @Get('selected-ingredients')
  @ApiOperation({ summary: '获取已选原料（支持分页和名称模糊查找）' })
  async getSelectedIngredients(
    @CurrentUser() user: User,
    @Query() query: SjEconPaginationDto,
  ) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    return this.service.getSelectedIngredients(
      user,
      this.MODULE_NAME,
      page,
      pageSize,
      query.name,
    );
  }
}
