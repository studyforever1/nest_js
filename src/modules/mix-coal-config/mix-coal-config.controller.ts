import { Controller, Put, Get, Body, Query, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { MixCoalConfigService } from './mix-coal-config.service';
import { SaveMixCoalConfigDto, SaveMixCoalParamsDto, DeleteMixCoalParamsDto, MixCoalPaginationDto } from './dto/mix-coal-config.dto';

@ApiTags('混合煤性价比计算-参数配置')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('mix-coal-config')
export class MixCoalConfigController {
  constructor(private readonly service: MixCoalConfigService) {}
  private readonly MODULE_NAME = '混合煤性价比计算';

  @Get('latest')
  @ApiOperation({ summary: '获取混合煤性价比参数' })
  async latest(@CurrentUser() user: User) {
    return this.service.getLatestConfig(user, this.MODULE_NAME);
  }

@Put('save')
@ApiOperation({ summary: '保存混合煤性价比参数' })
async save(@CurrentUser() user: User, @Body() body: SaveMixCoalConfigDto) {
  // 直接传递完整对象 fullConfig
  return this.service.saveFullConfig(user, this.MODULE_NAME, body.fullConfig);
}


  @Put('save-coal')
  @ApiOperation({ summary: '保存选中混合煤' })
  async saveCoal(@CurrentUser() user: User, @Body() body: SaveMixCoalParamsDto) {
    return this.service.saveSelectedCoals(user, this.MODULE_NAME, body.selectedIds || []);
  }

  @Get('selected-coal')
  async getSelectedCoal(
    @CurrentUser() user: User,
    @Query() query: MixCoalPaginationDto,
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
