import { Controller, Get, Put, Post, Delete, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { GlConfigService } from './gl-config.service';
import { SaveConfigDto } from './dto/save-config.dto';
import { SaveIngredientDto } from './dto/save-ingredient.dto';
import { DeleteIngredientDto } from './dto/delete-ingredient.dto';
import { PaginationDto } from './dto/pagination.dto';

@ApiTags('高炉配料参数配置接口')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('gl-config')
export class GlConfigController {
  constructor(private readonly glConfigService: GlConfigService) {}

  private readonly MODULE_NAME = '高炉配料计算';

  /** 获取最新参数组 */
  @Get('latest')
  @ApiOperation({
    summary: '获取最新高炉参数组',
    description:
      '获取当前用户最新保存的高炉配料计算参数组信息，ingredientLimits/fuelLimits/slageLimits对应原料/燃料/炉渣设置，otherSettings对应其他算法参数和优化设置。'
  })
  async latest(@CurrentUser() user: User) {
    return this.glConfigService.getLatestConfigByName(user, this.MODULE_NAME);
  }

  /** 保存完整参数组 */
  @Put('save')
  @ApiOperation({ summary: '保存完整参数组（原料/燃料/炉渣/其他参数）' })
  async save(@CurrentUser() user: User, @Body() body: SaveConfigDto) {
    return this.glConfigService.saveFullConfig(
      user,
      this.MODULE_NAME,
      body.ingredientLimits || {},
      body.fuelLimits || {},
      body.slagLimits || {},
      body.hotMetalRatio || {},
      body.loadTopLimits || {},
      body.ironWaterTopLimits || {},
      body.otherSettings || {},
    );
  }

  /** 保存选中原料/燃料（全选模式 & 分类模式） */
  @Post('save-selected')
  @ApiOperation({
    summary: '保存选中原料/燃料',
    description: `
【使用说明】

⭕ 全选模式（覆盖式设置）：
    - 当 category = "" 且 name = "" 时
    - ingredientParams 将作为新的完整选中列表

⭕ 分类模式（增删同步模式）：
    - 当 category 或 name 有值时
    - ingredientParams 只表示该分类下当前选中的内容
    - 后端会自动对比历史，执行添加 + 删除操作
    `
  })
  async saveSelected(
    @CurrentUser() user: User,
    @Body() body: SaveIngredientDto,
  ) {
    const ingredientParams = body.ingredientParams || [];
    return this.glConfigService.saveSelectedIngredients(
      user,
      this.MODULE_NAME,
      ingredientParams,
      body.category,
      body.name,
      body.type // 'ingredient' 或 'fuel'
    );
  }

  /** 删除选中原料/燃料 */
  @Delete('remove')
  @ApiOperation({ summary: '删除选中原料/燃料' })
  async removeSelected(
    @CurrentUser() user: User,
    @Body() body: DeleteIngredientDto,
  ) {
    return this.glConfigService.deleteSelected(
      user,
      this.MODULE_NAME,
      body.removeParams,
      body.type // 'ingredient' 或 'fuel'
    );
  }

  /** 分页获取已选原料/燃料 */
  @Get('selected')
  @ApiOperation({ summary: '获取已选原料/燃料（分页、搜索）' })
  async getSelected(
    @CurrentUser() user: User,
    @Query() dto: PaginationDto,
  ) {
    // dto.type 已经通过 SelectedQueryDto 验证为 'ingredient' | 'fuel' | ''
    // 如果为空字符串，后端可把它视为 undefined
    const type = dto.type && dto.type.length > 0 ? (dto.type as 'ingredient' | 'fuel') : undefined;

    return this.glConfigService.getSelectedItems(
      user,
      this.MODULE_NAME,
      dto.page,
      dto.pageSize,
      dto.name,
      type,
    );
  }
}
