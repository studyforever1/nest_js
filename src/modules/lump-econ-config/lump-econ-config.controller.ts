import { Controller, Put, Get, Body, Query, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { LumpEconConfigService } from './lump-econ-config.service';
import { SaveLumpEconConfigDto, SaveLumpParamsDto, DeleteLumpParamsDto, LumpEconPaginationDto } from './dto/lump-econ-config.dto';

@ApiTags('块矿经济性评价接口')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('lump-econ-config')
export class LumpEconConfigController {
  constructor(private readonly service: LumpEconConfigService) {}
  private readonly MODULE_NAME = '外购块矿经济性评价';

  @Get('latest')
  @ApiOperation({ summary: '获取块矿经济性参数' })
  async latest(@CurrentUser() user: User) {
    return this.service.getLatestConfig(user, this.MODULE_NAME);
  }

  @Put('save')
  @ApiOperation({ summary: '保存块矿经济性参数' })
  async save(@CurrentUser() user: User, @Body() body: SaveLumpEconConfigDto) {
    return this.service.saveFullConfig(user, this.MODULE_NAME, body.config_data);
  }

  @Put('save-lump')
  @ApiOperation({ summary: '保存选中块矿' })
  async saveLump(@CurrentUser() user: User, @Body() body: SaveLumpParamsDto) {
    return this.service.saveSelectedLumps(user, this.MODULE_NAME, body.selectedIds || [], body.name);
  }

  @Delete('lump')
  @ApiOperation({ summary: '删除选中块矿' })
  async deleteLump(@CurrentUser() user: User, @Body() body: DeleteLumpParamsDto) {
    return this.service.deleteLumpParams(user, this.MODULE_NAME, body.removeIds);
  }

  @Get('selected-lump')
  @ApiOperation({ summary: '获取已选块矿（分页、名称模糊）' })
  async getSelectedLump(@CurrentUser() user: User, @Query() query: LumpEconPaginationDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    return this.service.getSelectedLumps(user, this.MODULE_NAME, page, pageSize, query.name);
  }
}
