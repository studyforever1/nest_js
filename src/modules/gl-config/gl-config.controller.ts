import { Controller, Post, Body, Get, Put, Delete, Query, UseGuards } from '@nestjs/common';
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
  ],
})
async save(
  @CurrentUser() user: User,
  @Query('moduleName') moduleName: string,
  @Body() body: GLSaveConfigDto,
) {
  return this.glConfigService.saveFullConfig(
    user,
    moduleName,  // ← 改这里
    body.ingredientLimits,
    body.fuelLimits,
    body.slagLimits,
    body.hotMetalRatio,
    body.loadTopLimits,
    body.ironWaterTopLimits,
    body.otherSettings,
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

  @Get('selected-ingredients')
@ApiOperation({ summary: '分页查询已选原料', description: '支持分页、名称模糊搜索、分类筛选' })
async getSelectedIngredients(@CurrentUser() user: User, @Query() dto: GLPaginationDto) {
  return this.glConfigService.getSelectedIngredients({
    user,
    moduleName: this.MODULE_NAME,
    page: dto.page,
    pageSize: dto.pageSize,
    name: dto.name,
    type: dto.type,
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

  @Get('selected-fuels')
@ApiOperation({ summary: '分页查询已选燃料', description: '支持分页、名称模糊搜索、分类筛选' })
async getSelectedFuels(@CurrentUser() user: User, @Query() dto: GLPaginationDto) {
  return this.glConfigService.getSelectedFuels({
    user,
    moduleName: this.MODULE_NAME,
    page: dto.page,
    pageSize: dto.pageSize,
    name: dto.name,
    type: dto.type,
  });
}
}
