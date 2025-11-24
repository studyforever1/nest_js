import { Controller, Post, Body, Get, UseGuards, Query,Put,Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SjconfigService } from './sj-config.service';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { SaveConfigDto } from './dto/save-config.dto';
import { SaveIngredientDto } from './dto/save-ingredient.dto';
import { DeleteIngredientDto } from './dto/delete-ingredient.dto';
import { PaginationDto } from '../sj-raw-material/dto/pagination.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('烧结参数配置')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('sjconfig')
export class SjconfigController {
  constructor(private readonly sjconfigService: SjconfigService) {}

  private readonly MODULE_NAME = '烧结配料计算'; // 固定模块名

  /** 获取最新参数组 */
  @Get('latest')
  @ApiOperation({ summary: '获取最新参数组' })
  async latest(@CurrentUser() user: User) {
    return this.sjconfigService.getLatestConfigByName(user, this.MODULE_NAME);
  }

  /** 保存或更新完整参数组 */
  @Put('save')
@ApiOperation({ summary: '保存参数组（原料/化学/其他参数）' })
async save(@CurrentUser() user: User, @Body() body: SaveConfigDto) {
  return this.sjconfigService.saveFullConfig(
    user,
    this.MODULE_NAME,
    body.ingredientLimits,
    body.chemicalLimits,
    body.otherSettings,
  );
}


  /** 保存选中原料列表 */
  @Post('save-ingredient')
  @ApiOperation({ summary: '保存选中原料序号到参数组' })
  async saveIngredient(@CurrentUser() user: User, @Body() body: SaveIngredientDto) {
    return this.sjconfigService.saveIngredientParams(
      user,
      this.MODULE_NAME,
      body.ingredientParams,
    );
  }

  /** 删除选中的原料（同步更新精粉和固定配比） */
  @Delete('ingredient')
@ApiOperation({ summary: '删除选中的原料' })
async deleteIngredient(@CurrentUser() user: User, @Body() body: DeleteIngredientDto) {
  return this.sjconfigService.deleteIngredientParams(
    user,
    this.MODULE_NAME,
    body.removeParams,
  );
}

  /** 获取已选中原料详情（分页） */
  @Get('selected-ingredients')
  @ApiOperation({ summary: '获取已选中原料详情（分页）' })
  async getSelectedIngredients(
    @CurrentUser() user: User,
    @Query() pagination: PaginationDto,
  ) {
    return this.sjconfigService.getSelectedIngredients(
      user,
      this.MODULE_NAME,
      pagination.page,
      pagination.pageSize,
    );
  }
}
