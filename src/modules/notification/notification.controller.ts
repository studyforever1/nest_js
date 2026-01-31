import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { NotificationService } from './notification.service';
import {
  CreateNotificationDto,
  ListNotificationDto,
} from './dto/notification.dto';

@ApiTags('通知系统')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  /** ✅ 创建通知并分发给用户 */
  @Post()
  @ApiOperation({ summary: '创建通知', description: '创建一条新通知并发送给指定用户列表' })
  @ApiBody({
    description: '通知内容及接收用户',
    type: CreateNotificationDto,
  })
  create(
    @CurrentUser() user: User,
    @Body() body: CreateNotificationDto,
    @Body('users') users: User[],
  ) {
    return this.service.create(body, user, users);
  }

  /** ✅ 获取当前用户通知列表 */
  @Get()
  @ApiOperation({
    summary: '获取通知列表',
    description: '分页获取当前用户的通知，可按类型/关键词/最近 N 天/已读状态过滤，按优先级和时间排序',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码，默认1' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: '每页数量，默认10' })
  @ApiQuery({ name: 'type', required: false, type: String, description: '通知类型筛选' })
  @ApiQuery({ name: 'keyword', required: false, type: String, description: '标题关键词搜索' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: '最近N天的通知，默认1天' })
  list(@CurrentUser() user: User, @Query() query: ListNotificationDto) {
    return this.service.list(query, user);
  }

  /** ✅ 更新单条通知已读状态 */
  @Post('read')
  @ApiOperation({
    summary: '更新通知已读状态',
    description: '将当前用户的某条通知标记为已读或未读',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: '通知ID' },
        read: { type: 'boolean', description: '是否已读' },
      },
      required: ['id', 'read'],
    },
  })
  updateRead(@CurrentUser() user: User, @Body() body: { id: number; read: boolean }) {
    return this.service.updateReadStatus(user, body.id, body.read);
  }

  /** ✅ 批量更新通知已读状态 */
  @Post('read/batch')
  @ApiOperation({
    summary: '批量更新通知已读状态',
    description: '将当前用户的多条通知批量标记为已读或未读',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'number' }, description: '通知ID列表' },
        read: { type: 'boolean', description: '是否已读' },
      },
      required: ['ids', 'read'],
    },
  })
  batchUpdateRead(@CurrentUser() user: User, @Body() body: { ids: number[]; read: boolean }) {
    return this.service.batchUpdateReadStatus(user, body.ids, body.read);
  }
}
