import { Controller, Put, Get, Body, Query, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { CoalEconConfigService } from './coal-econ-config.service';
import { SaveCoalEconConfigDto, SaveCoalParamsDto, DeleteCoalParamsDto, CoalEconPaginationDto } from './dto/coal-econ-config.dto';

@ApiTags('喷吹煤经济性评价-参数配置')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('coal-econ-config')
export class CoalEconConfigController {
  constructor(private readonly service: CoalEconConfigService) {}
  private readonly MODULE_NAME = '喷吹煤经济性评价';

  @Get('latest')
  @ApiOperation({ summary: '获取喷吹煤经济性评价参数' })
  async latest(@CurrentUser() user: User) {
    return this.service.getLatestConfig(user, this.MODULE_NAME);
  }

  @Put('save')
  @ApiOperation({ summary: '保存喷吹煤经济性评价参数' })
  async save(@CurrentUser() user: User, @Body() body: SaveCoalEconConfigDto) {
    return this.service.saveFullConfig(user, this.MODULE_NAME, body.config_data);
  }

  @Put('save-coal')
  @ApiOperation({ summary: '保存选中喷吹煤' })
  async saveCoal(@CurrentUser() user: User, @Body() body: SaveCoalParamsDto) {
    return this.service.saveSelectedCoals(user, this.MODULE_NAME, body.selectedIds || [], body.name);
  }

  @Delete('coal')
  @ApiOperation({ summary: '删除选中喷吹煤' })
  async deleteCoal(@CurrentUser() user: User, @Body() body: DeleteCoalParamsDto) {
    return this.service.deleteCoalParams(user, this.MODULE_NAME, body.removeIds);
  }

  @Get('selected-coal')
async getSelectedCoal(
  @CurrentUser() user: User,
  @Query() query: CoalEconPaginationDto,
) {
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? 10);

  return this.service.getSelectedCoals(
    user,
    this.MODULE_NAME,
    page,
    pageSize,
    query.name,
  );
}

}
