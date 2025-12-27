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
      '获取当前用户最新保存的烧结配料计算参数组信息',
  })
  async latest(@CurrentUser() user: User) {
    return this.sjconfigService.getLatestConfigByName(
      user,
      this.MODULE_NAME,
    );
  }

  @Put('save')
  @ApiOperation({
    summary: '保存参数组（原料 / 化学 / 其他参数）',
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


}
