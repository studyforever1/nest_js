import {
  Controller,
  Put,
  Get,
  Body,
  Query,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { CokeEconConfigService } from './coke-econ-config.service';
import {
  SaveCokeEconConfigDto,
  SaveCokeParamsDto,
  DeleteCokeParamsDto,
  CokeEconPaginationDto,
} from './dto/coke-econ-config.dto';

@ApiTags('焦炭经济性评价-参数配置')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('coke-econ-config')
export class CokeEconConfigController {
  constructor(private readonly service: CokeEconConfigService) {}

  private readonly MODULE_NAME = '焦炭经济性评价';

  /** 获取最新完整参数 */
  @Get('latest')
  @ApiOperation({ summary: '获取焦炭经济性评价参数' })
  async latest(@CurrentUser() user: User) {
    return this.service.getLatestConfigByName(user, this.MODULE_NAME);
  }

  /** 保存完整参数组（覆盖 / merge） */
  @Put('save')
  @ApiOperation({ summary: '保存焦炭经济性评价参数' })
  async save(
    @CurrentUser() user: User,
    @Body() body: SaveCokeEconConfigDto,
  ) {
    return this.service.saveFullConfig(
      user,
      this.MODULE_NAME,
      body.config_data,
    );
  }

  /** 保存选中焦炭（全选 / 模糊模式） */
  @Put('save-coke')
  @ApiOperation({
    summary: '保存选中焦炭',
    description: `
⭕ 全选模式：selectedIds 覆盖 cokeParams  
⭕ 模糊查找模式：仅同步匹配 name 的焦炭
    `,
  })
  async saveCokeParams(
    @CurrentUser() user: User,
    @Body() body: SaveCokeParamsDto,
  ) {
    return this.service.saveSelectedCoke(
      user,
      this.MODULE_NAME,
      body.selectedIds,
      body.name,
    );
  }

  /** 删除选中焦炭 */
  @Delete('coke')
  @ApiOperation({ summary: '删除选中焦炭' })
  async deleteCokeParams(
    @CurrentUser() user: User,
    @Body() body: DeleteCokeParamsDto,
  ) {
    return this.service.deleteCokeParams(
      user,
      this.MODULE_NAME,
      body.removeIds,
    );
  }

  /** 获取已选焦炭（分页 + 模糊） */
  @Get('selected-coke')
  @ApiOperation({ summary: '获取已选焦炭（分页、名称模糊）' })
  async getSelectedCoke(
    @CurrentUser() user: User,
    @Query() query: CokeEconPaginationDto,
  ) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;

    return this.service.getSelectedCoke(
      user,
      this.MODULE_NAME,
      page,
      pageSize,
      query.name,
    );
  }
}
