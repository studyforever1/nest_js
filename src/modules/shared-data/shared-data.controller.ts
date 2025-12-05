// src/modules/shared-data/shared-data.controller.ts
import { Controller, Post, Body, Get, Query, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SharedDataService } from './shared-data.service';
import { User } from '../user/entities/user.entity';
import { SaveSharedDto } from './dto/save-shared.dto';
import { DeleteSharedDto } from './dto/delete-shared.dto';
import { ListSharedDto } from './dto/list-shared.dto';

@ApiTags('共享方案管理')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('shared-data')
export class SharedDataController {
  constructor(private readonly sharedService: SharedDataService) {}

  /** 批量保存共享方案 */
  @Post('save')
  @ApiOperation({ summary: '批量保存用户计算方案为共享方案' })
  async save(@CurrentUser() user: User, @Body() body: SaveSharedDto) {
    return this.sharedService.saveShared(
      body.taskUuid,
      user.user_id,
      body.schemeIndexes,
      body.module_type,
    );
  }

  /** 分页查询共享方案 */
  @Get('list')
  @ApiOperation({ summary: '获取共享方案（分页 + 模块筛选 + 日期筛选）' })
  async list(@CurrentUser() user: User, @Query() query: ListSharedDto) {
    return this.sharedService.list(user, query);
  }

  /** 删除共享方案 */
  @Delete('delete')
  @ApiOperation({ summary: '删除共享方案（按ID，可批量）' })
  async delete(@Body() body: DeleteSharedDto) {
    return this.sharedService.delete(body.ids);
  }
}
