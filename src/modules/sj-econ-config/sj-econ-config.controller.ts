import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiOkResponse } from '@nestjs/swagger';
import { SjEconConfigService } from './sj-econ-config.service';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { SaveSingleSinteringConfigDto } from './dto/save-single-sintering-config.dto';
import { SaveHotMetalCostConfigDto } from './dto/save-hot-metal-cost-config.dto';
import { SaveIngredientDto } from './dto/save-ingredient.dto';
import { DeleteIngredientDto } from './dto/delete-ingredient.dto';
import { PaginationDto } from './dto/pagination.dto';
import { ApiResponse } from '../../common/response/response.dto';

@ApiTags('烧结原料经济性评价参数设置')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('sj-econ-config')
export class SjEconConfigController {
  constructor(private readonly sjEconConfigService: SjEconConfigService) {}

  /**
   * 获取最新参数组
   */
  @Get()
  @ApiOperation({
    summary: '获取最新参数组',
    description: '获取当前用户最新保存的完整配置信息，包含ingredientParams、singleBurnSet、ironCostSet',
  })
  async getFullConfig(@CurrentUser() user: User) {
    try {
      const fullConfig = await this.sjEconConfigService.getFullConfig(user);
      const data = {
        ingredientParams: fullConfig.ingredientParams || [],
        singleBurnSet: fullConfig.singleBurnSet || {},
        ironCostSet: fullConfig.ironCostSet || {},
      };
      return ApiResponse.success(data, '获取参数成功');
    } catch (error: any) {
      return ApiResponse.error(error.message || '参数错误:名称不能为空', 4001);
    }
  }

  /**
   * 保存完整配置
   */
  @Put('save')
  @ApiOperation({
    summary: '保存完整配置',
    description: '保存或更新完整配置，包含ingredientParams、singleBurnSet、ironCostSet',
  })
  async saveFullConfig(
    @CurrentUser() user: User,
    @Body() body: {
      ingredientParams?: Record<string, any>;
      singleBurnSet?: Record<string, any>;
      ironCostSet?: Record<string, any>;
    },
  ) {
    try {
      const saved = await this.sjEconConfigService.saveFullConfig(user, body);
      return ApiResponse.success(saved, '保存成功');
    } catch (error: any) {
      return ApiResponse.error(error.message || '保存配置失败', 5002);
    }
  }

  /**
   * 单烧测算评价法-获取数据库已有的参数信息
   */
  @Get('single-sintering')
  @ApiOperation({
    summary: '获取单烧测算评价法参数',
    description: '获取当前用户最新保存的单烧测算评价法参数信息（singleBurnSet）',
  })
  async getSingleSinteringConfig(@CurrentUser() user: User) {
    try {
      const data = await this.sjEconConfigService.getSingleSinteringConfig(user);
      return ApiResponse.success(data, 'success');
    } catch (error: any) {
      return ApiResponse.error(error.message || '获取配置失败', 5001);
    }
  }

  /**
   * 单烧测算评价法-保存参数接口
   */
  @Put('single-sintering')
  @ApiOperation({
    summary: '保存单烧测算评价法参数',
    description: '保存或更新单烧测算评价法参数设置（singleBurnSet）',
  })
  async saveSingleSinteringConfig(
    @CurrentUser() user: User,
    @Body() dto: SaveSingleSinteringConfigDto,
  ) {
    try {
      const saved = await this.sjEconConfigService.saveSingleSinteringConfig(user, dto.params || {});
      return ApiResponse.success(saved, '保存成功');
    } catch (error: any) {
      return ApiResponse.error(error.message || '保存配置失败', 5002);
    }
  }

  /**
   * 铁水成本评价法-获取数据库已有的参数信息
   */
  @Get('hot-metal-cost')
  @ApiOperation({
    summary: '获取铁水成本评价法参数',
    description: '获取当前用户最新保存的铁水成本评价法参数信息（ironCostSet）',
  })
  async getHotMetalCostConfig(@CurrentUser() user: User) {
    try {
      const data = await this.sjEconConfigService.getHotMetalCostConfig(user);
      return ApiResponse.success(data, 'success');
    } catch (error: any) {
      return ApiResponse.error(error.message || '获取配置失败', 5001);
    }
  }

  /**
   * 铁水成本评价法-保存参数接口
   */
  @Put('hot-metal-cost')
  @ApiOperation({
    summary: '保存铁水成本评价法参数',
    description: '保存或更新铁水成本评价法参数设置（ironCostSet）',
  })
  async saveHotMetalCostConfig(
    @CurrentUser() user: User,
    @Body() dto: SaveHotMetalCostConfigDto,
  ) {
    try {
      const saved = await this.sjEconConfigService.saveHotMetalCostConfig(user, dto.params || {});
      return ApiResponse.success(saved, '保存成功');
    } catch (error: any) {
      return ApiResponse.error(error.message || '保存配置失败', 5002);
    }
  }

  /**
   * 修改 singleBurnSet 原料
   */
  @Patch('single-burn/raw-materials/:materialKey')
  @ApiParam({ name: 'materialKey', description: '原料键名，如：混匀料、溶剂、燃料、白灰', example: '混匀料' })
  @ApiOperation({
    summary: '修改 singleBurnSet 原料',
    description: '修改单烧综合评价法中的原料成分设置',
  })
  async updateSingleBurnRawMaterial(
    @CurrentUser() user: User,
    @Param('materialKey') materialKey: string,
    @Body() materialData: Record<string, any>,
  ) {
    try {
      const updated = await this.sjEconConfigService.updateSingleBurnRawMaterial(user, materialKey, materialData);
      return ApiResponse.success(updated, '修改单烧综合评价法原料成功');
    } catch (error: any) {
      return ApiResponse.error(error.message || '修改失败', 4001);
    }
  }

  /**
   * 修改 singleBurnSet 其他参数
   */
  @Patch('single-burn/other-settings')
  @ApiOperation({
    summary: '修改 singleBurnSet 其他参数',
    description: '修改单烧综合评价法中的其他参数设置',
  })
  async updateSingleBurnOtherSettings(
    @CurrentUser() user: User,
    @Body() otherSettings: Record<string, any>,
  ) {
    try {
      const updated = await this.sjEconConfigService.updateSingleBurnOtherSettings(user, otherSettings);
      return ApiResponse.success(updated, '修改单烧综合评价法其他参数成功');
    } catch (error: any) {
      return ApiResponse.error(error.message || '修改失败', 4001);
    }
  }

  /**
   * 修改 ironCostSet 原料
   */
  @Patch('iron-cost/raw-materials/:materialKey')
  @ApiParam({ name: 'materialKey', description: '原料键名，如：混匀料、溶剂、燃料、白灰', example: '混匀料' })
  @ApiOperation({
    summary: '修改 ironCostSet 原料',
    description: '修改铁水成本评价法中的原料成分设置',
  })
  async updateIronCostRawMaterial(
    @CurrentUser() user: User,
    @Param('materialKey') materialKey: string,
    @Body() materialData: Record<string, any>,
  ) {
    try {
      const updated = await this.sjEconConfigService.updateIronCostRawMaterial(user, materialKey, materialData);
      return ApiResponse.success(updated, '修改铁水成本评价法原料成功');
    } catch (error: any) {
      return ApiResponse.error(error.message || '修改失败', 4001);
    }
  }

  /**
   * 修改 ironCostSet 其他参数
   */
  @Patch('iron-cost/other-settings')
  @ApiOperation({
    summary: '修改 ironCostSet 其他参数',
    description: '修改铁水成本评价法中的其他参数设置',
  })
  async updateIronCostOtherSettings(
    @CurrentUser() user: User,
    @Body() otherSettings: Record<string, any>,
  ) {
    try {
      const updated = await this.sjEconConfigService.updateIronCostOtherSettings(user, otherSettings);
      return ApiResponse.success(updated, '修改铁水成本评价法其他参数成功');
    } catch (error: any) {
      return ApiResponse.error(error.message || '修改失败', 4001);
    }
  }

  /**
   * 修改 ironCostSet 焦炭和煤
   */
  @Patch('iron-cost/coke-coal')
  @ApiOperation({
    summary: '修改 ironCostSet 焦炭和煤',
    description: '修改铁水成本评价法中的焦炭和煤成分设置',
  })
  async updateIronCostCokeCoal(
    @CurrentUser() user: User,
    @Body() cokeCoalData: Record<string, any>,
  ) {
    try {
      const updated = await this.sjEconConfigService.updateIronCostCokeCoal(user, cokeCoalData);
      return ApiResponse.success(updated, '修改焦炭和煤参数成功');
    } catch (error: any) {
      return ApiResponse.error(error.message || '修改失败', 4001);
    }
  }

  /**
   * 保存选中原料（全选模式 & 分类模式）
   */
  @Post('save-ingredients')
  @ApiOperation({
    summary: '保存选中原料（全选模式 & 分类模式）',
    description: `
【使用说明】

⭕ 全选模式（覆盖式设置）：
    - 当 category = "" 且 name = "" 时
    - ingredientParams 将作为新的完整选中列表

⭕ 分类模式（增删同步模式）：
    - 当 category 有值 或 name 有值（任意一个有值即可）
    - ingredientParams 只表示该分类下当前选中的内容
    - 后端会自动对比历史，执行添加 + 删除操作（增量同步）
  `
  })
  @ApiOkResponse({
    description: '返回 { code, message, data }，data.ingredientParams 为最新列表',
    schema: { example: { code: 0, message: 'success', data: { ingredientParams: [1,2] } } },
  })
  async saveIngredients(
    @CurrentUser() user: User,
    @Body() body: SaveIngredientDto,
  ) {
    try {
      const selectedIds = body.ingredientParams || [];
      const result = await this.sjEconConfigService.saveSelectedIngredients(
        user,
        selectedIds,
  
      );
      return ApiResponse.success(result, '保存选中原料成功');
    } catch (error: any) {
      return ApiResponse.error(error.message || '保存失败', 4001);
    }
  }

  /**
   * 删除选中的原料
   */
  @Delete('ingredient')
  @ApiOperation({ 
    summary: '删除选中的原料',
    description: '删除选中的原料，从 ingredientParams 中移除'
  })
  @ApiOkResponse({
    description: '返回 { code, message, data }，data.ingredientParams 为删除后的列表',
  })
  async deleteIngredient(@CurrentUser() user: User, @Body() body: DeleteIngredientDto) {
    try {
      const result = await this.sjEconConfigService.deleteIngredientParams(
        user,
        body.removeParams,
      );
      return ApiResponse.success(result, '删除原料成功');
    } catch (error: any) {
      return ApiResponse.error(error.message || '删除失败', 4001);
    }
  }

  /**
   * 获取已选原料（分页、搜索）
   */
  @Get('selected-ingredients')
  @ApiOperation({
    summary: '获取已选原料（分页、搜索）',
    description: '获取当前用户已选中的原料列表，支持分页和搜索'
  })
  @ApiOkResponse({
    description: '返回 { code, message, data }，data 中包含分页字段 data/total/page/pageSize/totalPages',
    schema: { example: { code: 0, message: 'success', data: { data: [], total: 0, page: 1, pageSize: 10, totalPages: 0 } } },
  })
  async getSelectedIngredients(
    @CurrentUser() user: User,
    @Query() dto: PaginationDto,
  ) {
    try {
      const result = await this.sjEconConfigService.getSelectedIngredients(
        user,
        dto.page,
        dto.pageSize,
        dto.name,
      );
      return ApiResponse.success(result, '获取已选原料成功');
    } catch (error: any) {
      return ApiResponse.error(error.message || '获取失败', 4001);
    }
  }
}

