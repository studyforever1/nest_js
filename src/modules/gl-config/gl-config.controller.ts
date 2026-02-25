import { Controller, Post, Body, Get, Put, Delete, Query, UseGuards,Param,UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth,ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';

import { GlConfigService } from './gl-config.service';
import { GLSaveConfigDto } from './dto/gl-save-config.dto';
import { GLSaveIngredientDto } from './dto/gl-save-ingredient.dto';
import { GLSaveFuelDto } from './dto/gl-save-fuel.dto';
import { GLDeleteIngredientDto } from './dto/gl-delete-ingredient.dto';
import { GLDeleteFuelDto } from './dto/gl-delete-fuel.dto';
import { GLPaginationDto } from './dto/gl-pagination.dto';
import { GLAddProcessCostDto } from './dto/gl-add-process-cost.dto'; 
import { GLDeleteProcessCostDto } from './dto/gl-delete-process-cost.dto';
import { GLUpdateProcessCostDto } from './dto/gl-update-process-cost.dto';
import { GLListProcessCostDto } from './dto/gl-list-process-cost.dto';
import { BuiltinPowderAddDto } from '../sj-config/dto/builtin-powder-add.dto';
import { BuiltinPowderUpdateDto } from '../sj-config/dto/builtin-powder-update.dto';
import { BuiltinPowderDeleteDto } from '../sj-config/dto/builtin-powder-delete.dto';
import { BuiltinPowderListDto } from '../sj-config/dto/builtin-powder-list.dto';
import { UpdateSelectedIngredientDataDto } from './dto/update-selected-ingredient-data.dto';
import { UpdateSelectedFuelDataDto } from './dto/update-selected-fuel-data.dto';
import { GLRestoreIngredientsDto } from './dto/gl-restore-ingredients.dto';
import { GLRestoreFuelsDto } from './dto/gl-restore-fuels.dto';

@ApiTags('高炉参数配置接口')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('glconfig')
export class GlConfigController {
  private readonly MODULE_NAME = '单独高炉配料计算';

  constructor(private readonly glConfigService: GlConfigService) {}

  // ===================== 获取最新参数组 =====================
@Get('latest')
@ApiOperation({ summary: '获取最新参数组', description: '返回用户指定模块的最新配置' })
@ApiQuery({
  name: 'moduleName',
  required: true,
  description: '模块名称，可选：单独高炉配料计算 | 铁前一体化配料计算I | 铁前一体化配料计算II | 利润一体化配料计算',
  enum: [
    '单独高炉配料计算',
    '铁前一体化配料计算I',
    '铁前一体化配料计算II',
    '利润一体化配料计算',
    '生铁固定配料计算'
  ],
})
async latest(
  @CurrentUser() user: User,
  @Query('moduleName') moduleName: string,
) {
  return this.glConfigService.getLatestConfigByName(user, moduleName);
}



  // ===================== 保存完整参数组 =====================
@Put('save')
@ApiOperation({ summary: '保存完整参数组' })
@ApiQuery({
  name: 'moduleName',
  required: true,
  description: '模块名称，可选：单独高炉配料计算｜铁前一体化配料计算I｜铁前一体化配料计算II｜利润一体化配料计算',
  enum: [
    '单独高炉配料计算',
    '铁前一体化配料计算I',
    '铁前一体化配料计算II',
    '利润一体化配料计算',
    '生铁固定配料计算'
  ],
})
async save(
  @CurrentUser() user: User,
  @Query('moduleName') moduleName: string,
  @Body() body: GLSaveConfigDto,
) {
  return this.glConfigService.saveFullConfig(
    user,
    moduleName,
    body.ingredientLimits,
    body.fuelLimits,
    body.slagLimits,
    body.hotMetalRatio,
    body.loadTopLimits,
    body.ironWaterTopLimits,
    body.otherSettings,
    body.ingredientResults,   // ✅ 新增
    body.fuelResults,         // ✅ 新增
  );
}


  // ===================== 原料 =====================
  @Post('save-ingredients')
  @ApiOperation({ summary: '保存选中原料（全选 & 分类模式）' })
  async saveIngredients(@CurrentUser() user: User, @Body() body: GLSaveIngredientDto) {
    return this.glConfigService.saveSelectedIngredients(
      user,
      this.MODULE_NAME,
      body.ingredientParams || [],
      body.category,
      body.name,
    );
  }

  @Delete('ingredient')
  @ApiOperation({ summary: '删除选中原料' })
  async deleteIngredient(@CurrentUser() user: User, @Body() body: GLDeleteIngredientDto) {
    return this.glConfigService.deleteSelectedIngredients(user, this.MODULE_NAME, body.removeParams);
  }

  @Get('selected-fuels')
@ApiOperation({ summary: '分页查询已选燃料', description: '支持分页、名称模糊搜索、分类筛选' })
async getSelectedFuels(
  @CurrentUser() user: User,
  @Query() dto: GLPaginationDto
) {
  return this.glConfigService.getSelectedFuels({
    user,
    moduleName: this.MODULE_NAME,
    page: dto.page,
    pageSize: dto.pageSize,
    name: dto.name,
    type: dto.type, // 新增 type
    sort: dto.sort,
    order: dto.order,
  });
}

@Get('selected-ingredients')
@ApiOperation({ summary: '分页查询已选原料', description: '支持分页、名称模糊搜索、分类筛选' })
async getSelectedIngredients(
  @CurrentUser() user: User,
  @Query() dto: GLPaginationDto
) {
  return this.glConfigService.getSelectedIngredients({
    user,
    moduleName: this.MODULE_NAME,
    page: dto.page,
    pageSize: dto.pageSize,
    name: dto.name,
    type: dto.type, // 新增 type
    sort: dto.sort,
    order: dto.order,
  });


}
  // ===================== 燃料 =====================
  @Post('save-fuels')
  @ApiOperation({ summary: '保存选中燃料（全选 & 分类模式）' })
  async saveFuels(@CurrentUser() user: User, @Body() body: GLSaveFuelDto) {
    return this.glConfigService.saveSelectedFuels(
      user,
      this.MODULE_NAME,
      body.fuelParams || [],
      body.category,
      body.name,
    );
  }

  @Delete('fuel')
  @ApiOperation({ summary: '删除选中燃料' })
  async deleteFuel(@CurrentUser() user: User, @Body() body: GLDeleteFuelDto) {
    return this.glConfigService.deleteSelectedFuels(user, this.MODULE_NAME, body.removeParams);
  }

// ===================== 修改单条已选原料 =====================
@Put('selected-ingredient/:id')
@ApiOperation({ summary: '修改已选原料的数据（ingredientData 内）' })
async updateSelectedIngredient(
  @CurrentUser() user: User,
  @Param('id') id: string,
  @Body() dto: UpdateSelectedIngredientDataDto,
) {
  return this.glConfigService.updateSelectedIngredientData(
    user,
    this.MODULE_NAME,
    +id,
    dto,
    user.username,
  );
}

// ===================== 批量恢复已选原料 =====================
@Post('restore-ingredients')
@ApiOperation({ summary: '批量恢复选中原料数据（ingredientData 与原料库保持一致）' })
async restoreIngredients(
  @CurrentUser() user: User,
  @Body() body: GLRestoreIngredientsDto,
) {
  return this.glConfigService.restoreSelectedIngredients(
    user,
    this.MODULE_NAME,
    body.ids,
  );
}


// ===================== 修改单条已选燃料 =====================
@Put('selected-fuel/:id')
@ApiOperation({ summary: '修改已选燃料的数据（fuelData 内）' })
async updateSelectedFuel(
  @CurrentUser() user: User,
  @Param('id') id: string,
  @Body() dto: UpdateSelectedFuelDataDto,
) {
  return this.glConfigService.updateSelectedFuelData(
    user,
    this.MODULE_NAME,
    +id,
    dto,
    user.username,
  );
}

// ===================== 批量恢复已选燃料 =====================
@Post('restore-fuels')
@ApiOperation({ summary: '批量恢复选中燃料数据（fuelData 与燃料库保持一致）' })
async restoreFuels(
  @CurrentUser() user: User,
  @Body() body: GLRestoreFuelsDto,
) {
  return this.glConfigService.restoreSelectedFuels(
    user,
    this.MODULE_NAME,
    body.ids,
  );
}









// =====================================================
// 🔥 高炉工序成本（GLProcessCost）
// =====================================================
// =====================================================
// 🔥 高炉工序成本（完全参考烧结）
// =====================================================

@Post('gl-process-cost/add')
@ApiOperation({ summary: '新增 / 批量新增高炉工序成本' })
async addGLProcessCost(
  @CurrentUser() user: User,
  @Body() body: GLAddProcessCostDto,
) {
  return this.glConfigService.addGLProcessCost(
    user,
    body.items,
  );
}

@Post('gl-process-cost/delete')
@ApiOperation({ summary: '批量删除高炉工序成本' })
async deleteGLProcessCost(
  @CurrentUser() user: User,
  @Body() body: GLDeleteProcessCostDto,
) {
  return this.glConfigService.deleteGLProcessCost(
    user,
    body.keys,
  );
}

@Post('gl-process-cost/update')
@ApiOperation({ summary: '更新单个高炉工序成本（自动重算）' })
async updateGLProcessCost(
  @CurrentUser() user: User,
  @Body() body: GLUpdateProcessCostDto,
) {
  return this.glConfigService.updateGLProcessCost(
    user,
    body.key,
    body.payload,
  );
}

@Get('gl-process-cost/list')
@ApiOperation({ summary: '分页获取高炉工序成本列表' })
async getGLProcessCostList(
  @CurrentUser() user: User,
  @Query() query: GLListProcessCostDto,
) {
  return this.glConfigService.getGLProcessCostList(
    user,
    query.page,
    query.pageSize,
    query.keyword,
  );
}

  // =====================================================
  // 🔥 内置矿粉配比（BuiltinPowder）
  // =====================================================
  // 说明：内置矿粉配比用于存储高炉原料的默认上下限配置
  // 当选择高炉原料时，如果物料名称在内置矿粉配比中，会自动设置对应的上下限
  // 注意：高炉的内置矿粉配比数据保存在'单独高炉配料计算'模块中

  @Post('builtin-powder/add')
  @ApiOperation({ summary: '新增/批量新增内置矿粉配比', description: '支持批量添加多个物料的内置矿粉配比，物料名称不能重复' })
  async addBuiltinPowder(
    @CurrentUser() user: User,
    @Body() body: BuiltinPowderAddDto,
  ) {
    return this.glConfigService.addBuiltinPowder(user, body.items);
  }

  @Post('builtin-powder/update')
  @ApiOperation({ summary: '更新单个内置矿粉配比', description: '可以更新物料名称、上限、下限，如果更新名称则不能与已有名称重复' })
  async updateBuiltinPowder(
    @CurrentUser() user: User,
    @Body() body: BuiltinPowderUpdateDto,
  ) {
    return this.glConfigService.updateBuiltinPowder(
      user,
      body.key,
      {
        name: body.name,
        top_limit: body.top_limit,
        low_limit: body.low_limit,
      },
    );
  }

  @Post('builtin-powder/delete')
  @ApiOperation({ summary: '批量删除内置矿粉配比', description: '支持批量删除多个物料的内置矿粉配比' })
  async deleteBuiltinPowder(
    @CurrentUser() user: User,
    @Body() body: BuiltinPowderDeleteDto,
  ) {
    return this.glConfigService.deleteBuiltinPowder(user, body.keys);
  }

  @Get('builtin-powder/list')
  @ApiOperation({ summary: '分页获取内置矿粉配比列表', description: '支持按物料名称关键字搜索，支持分页查询' })
  async getBuiltinPowderList(
    @CurrentUser() user: User,
    @Query() query: BuiltinPowderListDto,
  ) {
    return this.glConfigService.getBuiltinPowderList(
      user,
      query.page,
      query.pageSize,
      query.keyword,
    );
  }

}
