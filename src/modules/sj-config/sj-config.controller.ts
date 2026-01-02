import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Query,
  Put,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { SjconfigService } from './sj-config.service';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { SJSaveConfigDto } from './dto/sj-save-config.dto';
import { SJSaveIngredientDto } from './dto/sj-save-ingredient.dto';
import { SJDeleteIngredientDto } from './dto/sj-delete-ingredient.dto';
import { SJPaginationDto } from './dto/sj-pagination.dto';
import { SJAddProcessCostDto } from './dto/sj-add-process-cost.dto';
import { SJDeleteProcessCostDto } from './dto/sj-delete-process-cost.dto';
import { SJUpdateProcessCostDto } from './dto/sj-update-process-cost.dto';
import { SJListProcessCostDto } from './dto/sj-list-process-cost.dto';
import { SJLatestConfigDto } from './dto/sj-latest-config.dto';
import { SaveFixedModuleConfigDto } from './dto/save-fixed-module-config.dto';
import { AddOtherSExpDto } from './dto/sulfur/other-exp-add.dto';
import { UpdateOtherSExpDto } from './dto/sulfur/other-exp-update.dto';
import { DeleteOtherSExpDto } from './dto/sulfur/other-exp-delete.dto';
import { AddExtMaterialDto } from './dto/sulfur/ext-material-add.dto';
import { UpdateExtMaterialDto } from './dto/sulfur/ext-material-update.dto';
import { DeleteExtMaterialDto } from './dto/sulfur/ext-material-delete.dto';
import { SulfurPaginationDto } from './dto/sulfur/sulfur-pagination.dto';

@ApiTags('烧结参数配置接口')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('sjconfig')
export class SjconfigController {
  constructor(private readonly sjconfigService: SjconfigService) {}

  private readonly MODULE_NAME = '烧结配料计算';

  // =====================================================
  // 基础参数
  // =====================================================

  @Get('latest')
@ApiOperation({
  summary: '获取最新参数组',
  description:
    '获取当前用户最新保存的指定模块的参数组信息，默认烧结配料计算',
})
async latest(
  @CurrentUser() user: User,
  @Query() query: SJLatestConfigDto,
) {
  // 如果前端没传 module，则使用默认模块
  const moduleName = query.module || this.MODULE_NAME;
  return this.sjconfigService.getLatestConfigByName(user, moduleName);
}

  @Put('save')
  @ApiOperation({
    summary: '保存烧结配料计算参数组（原料 / 化学 / 其他参数）',
  })
  async save(
    @CurrentUser() user: User,
    @Body() body: SJSaveConfigDto,
  ) {
    return this.sjconfigService.saveFullConfig(
      user,
      this.MODULE_NAME,
      body.ingredientLimits,
      body.chemicalLimits,
      body.otherSettings,
      body.SJProcessCost,
    );
  }

  // =====================================================
  // 原料选择
  // =====================================================

  @Post('save-ingredients')
  @ApiOperation({
    summary: '保存选中原料（全选 / 分类同步）',
  })
  async saveIngredients(
    @CurrentUser() user: User,
    @Body() body: SJSaveIngredientDto,
  ) {
    return this.sjconfigService.saveSelectedIngredients(
      user,
      this.MODULE_NAME,
      body.ingredientParams || [],
      body.category,
      body.name,
    );
  }

  @Delete('ingredient')
  @ApiOperation({ summary: '删除选中的原料' })
  async deleteIngredient(
    @CurrentUser() user: User,
    @Body() body: SJDeleteIngredientDto,
  ) {
    return this.sjconfigService.deleteIngredientParams(
      user,
      this.MODULE_NAME,
      body.removeParams,
    );
  }

  @Get('selected-ingredients')
  @ApiOperation({ summary: '获取已选原料（分页 / 搜索）' })
  async getSelectedIngredients(
    @CurrentUser() user: User,
    @Query() dto: SJPaginationDto,
  ) {
    return this.sjconfigService.getSelectedIngredients(
      user,
      this.MODULE_NAME,
      dto.page,
      dto.pageSize,
      dto.name,
      dto.type,
    );
  }

  // =====================================================
// 🔥 烧结工序成本（重点）
// =====================================================

@Post('sj-process-cost/add')
@ApiOperation({ summary: '新增/批量新增烧结工序成本' })
async addSJProcessCost(
  @CurrentUser() user: User,
  @Body() body: SJAddProcessCostDto,
) {
  return this.sjconfigService.addSJProcessCost(
    user,
    body.items,
  );
}

@Post('sj-process-cost/delete')
@ApiOperation({ summary: '批量删除烧结工序成本' })
async deleteSJProcessCost(
  @CurrentUser() user: User,
  @Body() body: SJDeleteProcessCostDto,
) {
  return this.sjconfigService.deleteSJProcessCost(
    user,
    body.keys,
  );
}

@Post('sj-process-cost/update')
@ApiOperation({ summary: '更新单个烧结工序成本' })
async updateSJProcessCost(
  @CurrentUser() user: User,
  @Body() body: SJUpdateProcessCostDto,
) {
  return this.sjconfigService.updateSJProcessCost(
    user,
    body.key,
    body.payload,
  );
}

@Get('sj-process-cost/list')
@ApiOperation({ summary: '分页获取工序成本列表' })
async getSJProcessCostList(
  @CurrentUser() user: User,
  @Query() query: SJListProcessCostDto,
) {
  return this.sjconfigService.getSJProcessCostList(
    user,
    query.page,
    query.pageSize,
    query.keyword,
  );
}

@Post('save-fixed-module')
@ApiOperation({
  summary: '保存固定配料 / 硫平衡模块参数',
  description: `
用于【烧结固定配料计算】和【硫平衡计算】模块，
保存 otherSettings 与 ingredientResults（覆盖式保存）
`,
})
@ApiBody({
  type: SaveFixedModuleConfigDto,
})
@ApiBearerAuth()
async saveFixedModuleConfig(
  @CurrentUser() user: User,
  @Body() dto: SaveFixedModuleConfigDto,
) {
  const { moduleName, otherSettings, ingredientResults } = dto;

  return this.sjconfigService.saveFixedModuleSettings(user, moduleName, {
    otherSettings,
    ingredientResults,
  });
}

// =====================================================
// 🔥 硫平衡 - 支出信息 otherSExp
// =====================================================

@Post('sulfur/other-exp/add')
@ApiOperation({ summary: '新增 / 批量新增硫支出信息' })
async addOtherSExp(
  @CurrentUser() user: User,
  @Body() body: AddOtherSExpDto,
) {
  return this.sjconfigService.addOtherSExp(user, body.items);
}

@Post('sulfur/other-exp/update')
@ApiOperation({ summary: '更新单条硫支出信息（PUT 语义）' })
async updateOtherSExp(
  @CurrentUser() user: User,
  @Body() body: UpdateOtherSExpDto,
) {
  return this.sjconfigService.updateOtherSExp(
    user,
    body.key,
    body,
  );
}

@Post('sulfur/other-exp/delete')
@ApiOperation({ summary: '批量删除硫支出信息' })
async deleteOtherSExp(
  @CurrentUser() user: User,
  @Body() body: DeleteOtherSExpDto,
) {
  return this.sjconfigService.deleteOtherSExp(user, body.keys);
}

// =====================================================
// 🔥 硫平衡 - 外配信息 extMaterial
// =====================================================

@Post('sulfur/ext-material/add')
@ApiOperation({ summary: '新增 / 批量新增外配信息' })
async addExtMaterial(
  @CurrentUser() user: User,
  @Body() body: AddExtMaterialDto,
) {
  return this.sjconfigService.addExtMaterial(user, body.items);
}

@Post('sulfur/ext-material/update')
@ApiOperation({ summary: '更新单条外配信息（PUT 语义）' })
async updateExtMaterial(
  @CurrentUser() user: User,
  @Body() body: UpdateExtMaterialDto,
) {
  return this.sjconfigService.updateExtMaterial(
    user,
    body.key,
    body,
  );
}

@Post('sulfur/ext-material/delete')
@ApiOperation({ summary: '批量删除外配信息' })
async deleteExtMaterial(
  @CurrentUser() user: User,
  @Body() body: DeleteExtMaterialDto,
) {
  return this.sjconfigService.deleteExtMaterial(user, body.keys);
}

@Get('sulfur/other-exp/list')
  @ApiOperation({ summary: '分页获取硫支出信息' })
  async listOtherSExp(
    @CurrentUser() user: User,
    @Query() query: SulfurPaginationDto,
  ) {
    return this.sjconfigService.getOtherSExpList(
      user,
      query.page,
      query.pageSize,
      query.keyword,
    );
  }

  // ===============================
  // 🔥 外配信息 extMaterial
  // ===============================

  @Get('sulfur/ext-material/list')
  @ApiOperation({ summary: '分页获取外配信息' })
  async listExtMaterial(
    @CurrentUser() user: User,
    @Query() query: SulfurPaginationDto,
  ) {
    return this.sjconfigService.getExtMaterialList(
      user,
      query.page,
      query.pageSize,
      query.keyword,
    );
  }
}


