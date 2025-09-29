import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { HistoryService } from './history.service';
import { DeleteHistoryDto } from './dto/delete-history.dto';
import { ListHistoryDto } from './dto/list-history.dto';

@ApiTags('历史记录管理')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  /** 查询历史记录 */
  @Get('list')
  @ApiOperation({ summary: '获取用户历史记录，可按模块类型筛选' })
  async list(
    @CurrentUser() user: User,
    @Query() query: ListHistoryDto,
  ) {
    return this.historyService.list(user, query.module_type);
  }

  /** 删除历史记录（单个或批量） */
  @Post('delete')
  @ApiOperation({ summary: '删除用户历史记录，支持单个或批量' })
  async delete(
    @CurrentUser() user: User,
    @Body() body: DeleteHistoryDto,
  ) {
    return this.historyService.delete(user, body.ids);
  }
}
