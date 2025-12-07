import { Controller, Post, Body, Get, UseGuards, Query,Put,Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth,ApiQuery } from '@nestjs/swagger';
import { SjconfigService } from './sj-config.service';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { SJSaveConfigDto } from './dto/sj-save-config.dto';
import { SJSaveIngredientDto } from './dto/sj-save-ingredient.dto';
import { SJDeleteIngredientDto } from './dto/sj-delete-ingredient.dto';
import { SJPaginationDto } from './dto/sj-pagination.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('烧结参数配置接口')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('sjconfig')
export class SjconfigController {
  constructor(private readonly sjconfigService: SjconfigService) {}

  private readonly MODULE_NAME = '烧结配料计算'; // 固定模块名

  /** 获取最新参数组 */
  @Get('latest')
  @ApiOperation({ summary: '获取最新参数组',
    description: '获取当前用户最新保存的烧结配料计算参数组信息，chemicalLimits对应烧结矿化学成分设置，\
    ingredientLimits对应烧结矿原料配比设置，otherSettings对应其他参数设置和算法设置，其中精粉和固定配比不需要\
    呈现，其他参数设置中只有其他费用、计划上料量、脱硫率、烟气流量，其他参数都属于算法设置。化学成分余量设置暂时不用。 '
   })
  async latest(@CurrentUser() user: User) {
    return this.sjconfigService.getLatestConfigByName(user, this.MODULE_NAME);
  }

  /** 保存或更新完整参数组 */
  @Put('save')
@ApiOperation({ summary: '保存参数组（原料/化学/其他参数）',
    description: '对应区间品位配料-烧结工序中的确定并保存按钮'
    })
async save(@CurrentUser() user: User, @Body() body: SJSaveConfigDto) {
  return this.sjconfigService.saveFullConfig(
    user,
    this.MODULE_NAME,
    body.ingredientLimits,
    body.chemicalLimits,
    body.otherSettings,
  );
}

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
async saveIngredients(
  @CurrentUser() user: User,
  @Body() body: SJSaveIngredientDto,
) {
  // 传给 service 时，确保 selectedIds 不为 undefined，默认空数组
  const selectedIds = body.ingredientParams || [];
  return this.sjconfigService.saveSelectedIngredients(
    user,
    this.MODULE_NAME,
    selectedIds,
    body.category,
    body.name
  );
}


  /** 删除选中的原料（同步更新精粉和固定配比） */
  @Delete('ingredient')
@ApiOperation({ summary: '删除选中的原料',
    description: '对应烧结物料信息中的删除按钮'  })
async deleteIngredient(@CurrentUser() user: User, @Body() body: SJDeleteIngredientDto) {
  return this.sjconfigService.deleteIngredientParams(
    user,
    this.MODULE_NAME,
    body.removeParams,
  );
}

 @Get('selected-ingredients')
@ApiOperation({
  summary: '获取已选原料（分页、搜索）',
})
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



}
