import { Controller, Post, Get, Body, Query, UseGuards, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../user/entities/user.entity';
import { NotificationService } from './notification.service';
import { CreateNotificationDto, ListNotificationDto, DeleteNotificationDto } from './dto/notification.dto';

@ApiTags('通知系统')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Post()
  @ApiOperation({ summary: '创建通知' })
  create(@CurrentUser() user: User, @Body() body: CreateNotificationDto) {
    return this.service.create(body, user);
  }

  @Get()
  @ApiOperation({ summary: '分页获取通知，可按类型/关键词搜索/最近 N 天，按优先级和时间排序' })
  list(@Query() query: ListNotificationDto) {
    return this.service.list(query);
  }

  @Delete()
  @ApiOperation({ summary: '删除通知' })
  delete(@Body() body: DeleteNotificationDto) {
    return this.service.delete(body.ids);
  }
}
